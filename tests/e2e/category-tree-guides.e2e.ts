import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

type GuideLine = {
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isOnly: boolean;
  readonly lineBottom: number;
  readonly lineTop: number;
  readonly rowCentre: number;
};

/**
 * 树状导引线的几何断言：每条竖线的两端必须落在对应行的中线上。
 * 回归的是「末项展开子树后，竖线被拖到子树底部、指向不存在的文件夹」这个缺陷
 * —— 当时用整棵子树的 ::before 拉一条线，收尾按固定偏移算，末项一展开就错位。
 */
async function readGuideLines(page: import("@playwright/test").Page): Promise<GuideLine[]> {
  return page.evaluate(() => {
    const result: Array<{
      isFirst: boolean;
      isLast: boolean;
      isOnly: boolean;
      lineBottom: number;
      lineTop: number;
      rowCentre: number;
    }> = [];
    for (const tree of Array.from(document.querySelectorAll<HTMLElement>(".category-tree"))) {
      if (tree.dataset["depth"] === "0") continue;
      const nodes = Array.from(tree.children).filter((child) =>
        child.classList.contains("category-node"),
      );
      nodes.forEach((node, index) => {
        const element = node as HTMLElement;
        const pseudo = getComputedStyle(element, "::before");
        const nodeBox = element.getBoundingClientRect();
        const line = node.querySelector<HTMLElement>(":scope > .category-node-line");
        const lineBox = line?.getBoundingClientRect();
        const offsetTop = pseudo.top === "auto" ? 0 : Number.parseFloat(pseudo.top);
        const height = Number.parseFloat(pseudo.height);
        const lineTop = nodeBox.top + offsetTop;
        const lineBottom =
          pseudo.bottom === "auto" && !Number.isNaN(height)
            ? lineTop + height
            : nodeBox.bottom - Number.parseFloat(pseudo.bottom);
        result.push({
          isFirst: index === 0,
          isLast: index === nodes.length - 1,
          isOnly: nodes.length === 1,
          lineBottom,
          lineTop,
          rowCentre: lineBox === undefined ? 0 : lineBox.top + lineBox.height / 2,
        });
      });
    }
    return result;
  });
}

test("stops each tree guide line at its own row centre", async () => {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const runtimeRoot = await mkdtemp(join(tmpdir(), "dnf-tree-guide-e2e-"));
  const libraryRoot = join(runtimeRoot, "patch-categories");
  // 末项自身带子树：这是触发旧缺陷的关键结构，若只建叶子节点则测不出回归。
  await mkdir(join(libraryRoot, "父目录", "末项目录", "深层子目录"), { recursive: true });
  await mkdir(join(libraryRoot, "父目录", "中间目录"), { recursive: true });
  await mkdir(join(libraryRoot, "父目录", "独子父级", "独子"), { recursive: true });

  const application = await electron.launch({
    args: [`--user-data-dir=${join(runtimeRoot, "electron-data")}`, projectRoot],
    cwd: runtimeRoot,
  });
  try {
    const page = await application.firstWindow();
    await page.getByRole("main", { name: "补丁工作区" }).waitFor();
    await page.getByRole("button", { name: "父目录", exact: true }).waitFor();

    for (const label of ["展开 父目录", "展开 末项目录", "展开 独子父级"]) {
      await page.evaluate((target: string) => {
        document.querySelector<HTMLElement>(`[aria-label="${target}"]`)?.click();
      }, label);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(300);

    const lines = await readGuideLines(page);
    expect(lines.length).toBeGreaterThan(0);

    // 末项竖线收在自己的行中线，不再延伸到展开后的子树底部。
    const lastLines = lines.filter((line) => line.isLast);
    expect(lastLines.length).toBeGreaterThan(0);
    for (const line of lastLines) {
      expect(Math.abs(line.lineBottom - line.rowCentre)).toBeLessThanOrEqual(2);
    }

    // 非独子的首项从自己的行中线起笔。
    for (const line of lines.filter((entry) => entry.isFirst && !entry.isOnly)) {
      expect(Math.abs(line.lineTop - line.rowCentre)).toBeLessThanOrEqual(2);
    }

    // 独子只保留一个「└」折角：竖线高度不超过半行。
    for (const line of lines.filter((entry) => entry.isOnly)) {
      expect(line.lineBottom - line.lineTop).toBeLessThanOrEqual(line.rowCentre - line.lineTop + 2);
    }
  } finally {
    await application.close();
    await rm(runtimeRoot, { recursive: true, force: true });
  }
});

import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

type SubtreeGeometry = {
  readonly arrowCentreX: number;
  readonly arrowGlyphBottom: number;
  readonly depth: string;
  readonly lineBottom: number;
  readonly lineLeft: number;
  readonly lineTop: number;
  readonly parentRowCentre: number;
  readonly tailRowCentre: number;
};

/**
 * 读取每棵子树竖线的实际几何，用于断言它把父级行与末项行连起来。
 * 竖线画在各 `.category-node::before` 上，top 相对节点盒、末项改用 height 收笔，
 * 因此这里要同时处理 top 与 height 两种取值。
 */
async function readSubtrees(page: import("@playwright/test").Page): Promise<SubtreeGeometry[]> {
  return page.evaluate(() => {
    const result: Array<{
      arrowCentreX: number;
      arrowGlyphBottom: number;
      depth: string;
      lineBottom: number;
      lineLeft: number;
      lineTop: number;
      parentRowCentre: number;
      tailRowCentre: number;
    }> = [];
    for (const tree of Array.from(document.querySelectorAll<HTMLElement>(".category-tree"))) {
      const depth = tree.dataset["depth"] ?? "0";
      if (depth === "0") continue;
      const nodes = Array.from(tree.children).filter((child) =>
        child.classList.contains("category-node"),
      );
      const first = nodes[0];
      const tail = nodes.at(-1);
      if (first === undefined || tail === undefined) continue;

      const parentRow = tree.parentElement?.querySelector<HTMLElement>(
        ":scope > .category-node-line",
      );
      const parentBox = parentRow?.getBoundingClientRect();
      const tailRow = tail.querySelector<HTMLElement>(":scope > .category-node-line");
      const tailBox = tailRow?.getBoundingClientRect();

      // 首项竖线的起点
      const firstPseudo = getComputedStyle(first, "::before");
      const firstBox = first.getBoundingClientRect();
      const firstOffset = firstPseudo.top === "auto" ? 0 : Number.parseFloat(firstPseudo.top);
      const lineTop = firstBox.top + firstOffset;
      const lineLeft =
        firstBox.left + (firstPseudo.left === "auto" ? 0 : Number.parseFloat(firstPseudo.left));

      // 竖线要对准父级展开箭头的中心，而不是按钮盒中心：按钮默认内边距会把
      // 图标挤出内容区，只按盒子几何算会偏左数像素。
      // 字形边界取 svg 里的 path：svg 盒含图标内边距，比实际笔画大一圈。
      const arrow = parentRow?.querySelector<HTMLElement>(".category-expand");
      const arrowSvg = arrow?.querySelector("svg");
      const arrowPath = arrowSvg?.querySelector("path");
      const arrowBox = (arrowPath ?? arrowSvg ?? arrow)?.getBoundingClientRect();
      // 末项竖线的终点：末项用 height 收笔，否则落到节点底部
      const tailPseudo = getComputedStyle(tail, "::before");
      const tailElementBox = tail.getBoundingClientRect();
      const tailOffset = tailPseudo.top === "auto" ? 0 : Number.parseFloat(tailPseudo.top);
      const tailHeight = Number.parseFloat(tailPseudo.height);
      const lineBottom =
        tailPseudo.bottom === "auto" && !Number.isNaN(tailHeight)
          ? tailElementBox.top + tailOffset + tailHeight
          : tailElementBox.bottom - Number.parseFloat(tailPseudo.bottom);

      result.push({
        arrowCentreX: arrowBox === undefined ? 0 : arrowBox.left + arrowBox.width / 2,
        arrowGlyphBottom: arrowBox === undefined ? 0 : arrowBox.bottom,
        depth,
        lineBottom,
        lineLeft,
        lineTop,
        parentRowCentre: parentBox === undefined ? 0 : parentBox.top + parentBox.height / 2,
        tailRowCentre: tailBox === undefined ? 0 : tailBox.top + tailBox.height / 2,
      });
    }
    return result;
  });
}

test("connects each subtree guide line from the parent row to the last child row", async () => {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const runtimeRoot = await mkdtemp(join(tmpdir(), "dnf-tree-guide-e2e-"));
  const libraryRoot = join(runtimeRoot, "patch-categories");
  // 末项自带子树：这是「竖线越过末项行中线、指向空白」的触发结构；
  // 若测试数据里末项都是叶子，那个回归测不出来。
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

    const subtrees = await readSubtrees(page);
    expect(subtrees.length).toBeGreaterThan(0);

    for (const subtree of subtrees) {
      // 顶端接在父级行中线下方（留间距），既不断开也不贴住展开箭头。
      const topGap = subtree.lineTop - subtree.parentRowCentre;
      expect(topGap).toBeGreaterThanOrEqual(4);
      expect(topGap).toBeLessThanOrEqual(8);
      // 顶端必须落在箭头笔画下缘之下：接进箭头内部就是「贯穿」。
      expect(subtree.lineTop).toBeGreaterThanOrEqual(subtree.arrowGlyphBottom);
      // 底端必须落在末项行中线：越过它就会指向没有文件夹的空白。
      expect(Math.abs(subtree.lineBottom - subtree.tailRowCentre)).toBeLessThanOrEqual(2);
      // 横向必须对准箭头图标中心：按按钮盒算会偏左，因为按钮默认内边距
      // 把图标挤出内容区。
      expect(Math.abs(subtree.lineLeft - subtree.arrowCentreX)).toBeLessThanOrEqual(1.5);
    }
  } finally {
    await application.close();
    await rm(runtimeRoot, { recursive: true, force: true });
  }
});

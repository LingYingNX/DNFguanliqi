import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("widens the sidebar from its right edge so long folder names fit", async () => {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const runtimeRoot = await mkdtemp(join(tmpdir(), "dnf-sidebar-resize-e2e-"));
  const folderName = "这是一条很长的补丁文件夹名称";
  await mkdir(join(runtimeRoot, "patch-categories", folderName), { recursive: true });

  const application = await electron.launch({
    args: [`--user-data-dir=${join(runtimeRoot, "electron-data")}`, projectRoot],
    cwd: runtimeRoot,
  });

  try {
    const page = await application.firstWindow();
    await page.setViewportSize({ width: 1120, height: 720 });
    await page.getByRole("main", { name: "补丁工作区" }).waitFor();

    const sidebar = page.getByRole("navigation", { name: "补丁分类" });
    const handle = page.getByRole("separator", { name: "调整侧边栏宽度" });
    const folder = sidebar.getByRole("button", { name: folderName, exact: true });
    const label = folder.locator("span").first();
    await expect(folder).toHaveAttribute("title", folderName);

    const [initialSidebarBox, initialHandleBox] = await Promise.all([
      sidebar.boundingBox(),
      handle.boundingBox(),
    ]);
    expect(initialSidebarBox).not.toBeNull();
    expect(initialHandleBox).not.toBeNull();
    if (initialSidebarBox === null || initialHandleBox === null) {
      throw new Error("Sidebar resize controls did not expose visible bounds");
    }
    expect(Math.round(initialSidebarBox.width)).toBe(232);
    expect(await label.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

    const startX = initialHandleBox.x + initialHandleBox.width / 2;
    const startY = initialHandleBox.y + initialHandleBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 220, startY, { steps: 8 });
    await page.mouse.up();

    const [resizedSidebarBox, workspaceBox] = await Promise.all([
      sidebar.boundingBox(),
      page.locator("main.patch-workspace").boundingBox(),
    ]);
    expect(resizedSidebarBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    if (resizedSidebarBox === null || workspaceBox === null) {
      throw new Error("Resized layout did not expose visible bounds");
    }
    expect(Math.round(resizedSidebarBox.width)).toBe(452);
    expect(Math.abs(workspaceBox.x - resizedSidebarBox.width)).toBeLessThanOrEqual(1);
    expect(await label.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      })),
    ).toEqual({ client: 1120, scroll: 1120 });
  } finally {
    await application.close();
    await rm(runtimeRoot, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
  }
});

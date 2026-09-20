import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("keeps the custom category order after renaming a folder", async () => {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const runtimeRoot = await mkdtemp(join(tmpdir(), "dnf-rename-order-e2e-"));
  const libraryRoot = join(runtimeRoot, "patch-categories");
  // 目录名与默认名称排序相反，便于区分"保持自定义顺序"与"退回按名称排序"。
  await mkdir(join(libraryRoot, "Zeta"), { recursive: true });
  await mkdir(join(libraryRoot, "Alpha"), { recursive: true });
  await mkdir(join(libraryRoot, "Middle"), { recursive: true });

  const application = await electron.launch({
    args: [`--user-data-dir=${join(runtimeRoot, "electron-data")}`, projectRoot],
    cwd: runtimeRoot,
  });
  try {
    const page = await application.firstWindow();
    await page.getByRole("main", { name: "补丁工作区" }).waitFor();

    const sidebar = page.getByRole("navigation", { name: "补丁分类" });
    const rowOrder = async (): Promise<readonly string[]> =>
      sidebar
        .locator(".category-tree .category-row")
        .evaluateAll((rows) =>
          rows
            .map((row) => (row.textContent ?? "").replace(/\s+/gu, " ").trim())
            .filter((text) => /^(Zeta|Alpha|Middle|Renamed)\d*$/u.test(text)),
        );

    await expect(sidebar.getByRole("button", { name: "Zeta", exact: true })).toBeVisible();
    const defaultOrder = await rowOrder();
    expect(defaultOrder).toEqual(["Alpha0", "Middle0", "Zeta0"]);

    // 写入自定义顺序 Zeta 在前，与名称排序相反。
    const saved = await page.evaluate(() =>
      window.dnf.setCategoryOrder({
        parentRelativePath: "",
        orderedChildRelativePaths: ["Zeta", "Alpha", "Middle"],
      }),
    );
    expect(saved).toMatchObject({ ok: true });
    // 直接调 IPC 绕过了渲染层的重新扫描，重载后从磁盘读回自定义顺序。
    await page.reload();
    await page.getByRole("main", { name: "补丁工作区" }).waitFor();
    await expect.poll(async () => (await rowOrder())[0]).toBe("Zeta0");
    const customOrder = await rowOrder();
    expect(customOrder).toEqual(["Zeta0", "Alpha0", "Middle0"]);

    // 重命名 Zeta -> Renamed：应停在原位，而不是按名称重新插入。
    await sidebar.getByRole("button", { name: "Zeta", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "重命名" }).click();
    const input = page.getByRole("textbox", { name: "重命名 Zeta" });
    await input.fill("Renamed");
    await input.press("Enter");

    await expect(sidebar.getByRole("button", { name: "Renamed", exact: true })).toBeVisible();
    await expect.poll(async () => (await rowOrder())[0]).toBe("Renamed0");
    const afterRename = await rowOrder();
    expect(afterRename).toEqual(["Renamed0", "Alpha0", "Middle0"]);
  } finally {
    await application.close();
    await rm(runtimeRoot, { recursive: true, force: true });
  }
});

test("keeps a renamed folder in place even when the order was never customized", async () => {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const runtimeRoot = await mkdtemp(join(tmpdir(), "dnf-rename-order-default-e2e-"));
  const libraryRoot = join(runtimeRoot, "patch-categories");
  // 数字名让"按名称排序"与"保持原位"产生可见差异：2 改名成 9 后按名称会跳到末尾。
  for (const name of ["1", "2", "3"]) {
    await mkdir(join(libraryRoot, name), { recursive: true });
  }

  const application = await electron.launch({
    args: [`--user-data-dir=${join(runtimeRoot, "electron-data")}`, projectRoot],
    cwd: runtimeRoot,
  });
  try {
    const page = await application.firstWindow();
    await page.getByRole("main", { name: "补丁工作区" }).waitFor();

    const sidebar = page.getByRole("navigation", { name: "补丁分类" });
    const rowOrder = async (): Promise<readonly string[]> =>
      sidebar
        .locator(".category-tree .category-row")
        .evaluateAll((rows) =>
          rows
            .map((row) => (row.textContent ?? "").replace(/\s+/gu, " ").trim())
            .filter((text) => /^[0-9A-Za-z]+0$/u.test(text)),
        );

    expect(await rowOrder()).toEqual(["10", "20", "30"]);

    await sidebar.getByRole("button", { name: "2", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "重命名" }).click();
    const input = page.getByRole("textbox", { name: "重命名 2" });
    await input.fill("9");
    await input.press("Enter");

    await expect(sidebar.getByRole("button", { name: "9", exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    // 未排序过的分类也要锁在原位，而不是按新名字重新插入。
    expect(await rowOrder()).toEqual(["10", "90", "30"]);
  } finally {
    await application.close();
    await rm(runtimeRoot, { recursive: true, force: true });
  }
});

test("keeps existing order when the saved record is stale and incomplete", async () => {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const runtimeRoot = await mkdtemp(join(tmpdir(), "dnf-stale-order-e2e-"));
  const libraryRoot = join(runtimeRoot, "patch-categories");
  // 复现真实数据：目录 1/4/5/技能，但记录只含 ["技能","256"]——256 已删除、其余从未记录。
  // 这种陈旧不完整记录曾导致固化被跳过，未记录的分类一直按名称排序。
  for (const name of ["1", "4", "5", "技能"]) {
    await mkdir(join(libraryRoot, name), { recursive: true });
  }
  const dataRoot = join(runtimeRoot, "data");
  await mkdir(dataRoot, { recursive: true });
  await writeFile(
    join(dataRoot, "category-order.json"),
    JSON.stringify({ formatVersion: 1, orders: { "": ["技能", "256"] } }),
    "utf8",
  );

  const application = await electron.launch({
    args: [`--user-data-dir=${join(runtimeRoot, "electron-data")}`, projectRoot],
    cwd: runtimeRoot,
  });
  try {
    const page = await application.firstWindow();
    await page.getByRole("main", { name: "补丁工作区" }).waitFor();

    const sidebar = page.getByRole("navigation", { name: "补丁分类" });
    const rowOrder = async (): Promise<readonly string[]> =>
      sidebar
        .locator(".category-tree .category-row")
        .evaluateAll((rows) =>
          rows
            .map((row) => (row.textContent ?? "").replace(/\s+/gu, " ").trim())
            .filter((text) => /^(1|4|5|9|3|技能)\d*$/u.test(text)),
        );

    // 记录中技能在首位，它必须留在首位而不是被挤到数字后面。
    expect(await rowOrder()).toEqual(["技能0", "10", "40", "50"]);

    // 新建 3：应追加到末尾，且不改变技能的位置。
    await sidebar.getByRole("button", { name: "新建子分类" }).click();
    const nameInput = page.getByRole("textbox", { name: "分类名称" });
    await nameInput.fill("3");
    await nameInput.press("Enter");
    await expect(sidebar.getByRole("button", { name: "3", exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    expect(await rowOrder()).toEqual(["技能0", "10", "40", "50", "30"]);

    // 重命名 4 -> 9：位置保持，技能仍在首位。
    await sidebar.getByRole("button", { name: "4", exact: true }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "重命名" }).click();
    const renameInput = page.getByRole("textbox", { name: "重命名 4" });
    await renameInput.fill("9");
    await renameInput.press("Enter");
    await expect(sidebar.getByRole("button", { name: "9", exact: true })).toBeVisible();
    await page.waitForTimeout(400);
    expect(await rowOrder()).toEqual(["技能0", "10", "90", "50", "30"]);
  } finally {
    await application.close();
    await rm(runtimeRoot, { recursive: true, force: true });
  }
});

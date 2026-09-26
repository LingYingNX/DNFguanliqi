import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("uses a black placeholder for patch cards without preview images", async () => {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const runtimeRoot = await mkdtemp(join(tmpdir(), "dnf-preview-placeholder-e2e-"));
  await mkdir(join(runtimeRoot, "patch-categories"), { recursive: true });
  await writeFile(join(runtimeRoot, "patch-categories", "A.npk"), "patch");

  const application = await electron.launch({
    args: [`--user-data-dir=${join(runtimeRoot, "electron-data")}`, projectRoot],
    cwd: runtimeRoot,
  });

  try {
    const page = await application.firstWindow();
    await page.getByRole("main", { name: "补丁工作区" }).waitFor();
    const preview = page
      .getByRole("button", { name: "A.npk", exact: true })
      .locator(".item-preview");

    await expect(preview.locator(".item-preview-image")).toHaveCount(0);
    await expect(preview).toHaveCSS("background-color", "rgb(0, 0, 0)");
  } finally {
    await application.close();
    await rm(runtimeRoot, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
  }
});

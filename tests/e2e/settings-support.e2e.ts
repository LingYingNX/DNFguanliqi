import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("renders the community entries within the settings dialog", async () => {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const runtimeRoot = await mkdtemp(join(tmpdir(), "dnf-settings-support-e2e-"));
  const screenshotRoot = join(projectRoot, ".scratch", "settings-support");
  await mkdir(screenshotRoot, { recursive: true });
  const application = await electron.launch({ args: [projectRoot], cwd: runtimeRoot });

  try {
    const page = await application.firstWindow();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole("button", { name: "设置" }).click();

    const dialog = page.getByRole("dialog", { name: "设置" });
    const browseButton = dialog.getByRole("button", { name: "浏览", exact: true });
    const supportCard = dialog.locator('.settings-community-card[data-kind="afdian"]');
    const bilibiliCard = dialog.locator('.settings-community-card[data-kind="bilibili"]');
    const supportButton = dialog.getByRole("button", { name: "在浏览器中打开爱发电主页" });
    const bilibiliButton = dialog.getByRole("button", { name: "在浏览器中打开哔哩哔哩主页" });
    await expect(dialog.getByRole("heading", { name: "支持与社区" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "请作者喝杯咖啡 ☕" })).toBeVisible();
    await expect(
      dialog.getByText(
        "本软件完全免费且开源。如果您觉得它有帮助，欢迎前往爱发电给予我持续维护的动力！",
      ),
    ).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "哔哩哔哩主页" })).toBeVisible();
    await expect(dialog.getByText("关注最新动态、视频教程与更新发布")).toBeVisible();
    await expect(supportButton).toBeVisible();
    await expect(bilibiliCard).toBeVisible();
    await expect(bilibiliButton).toBeVisible();

    const [
      dialogBox,
      browseButtonBox,
      supportCardBox,
      bilibiliCardBox,
      supportButtonBox,
      bilibiliButtonBox,
    ] = await Promise.all([
      dialog.boundingBox(),
      browseButton.boundingBox(),
      supportCard.boundingBox(),
      bilibiliCard.boundingBox(),
      supportButton.boundingBox(),
      bilibiliButton.boundingBox(),
    ]);
    expect(dialogBox).not.toBeNull();
    expect(browseButtonBox).not.toBeNull();
    expect(supportCardBox).not.toBeNull();
    expect(bilibiliCardBox).not.toBeNull();
    expect(supportButtonBox).not.toBeNull();
    expect(bilibiliButtonBox).not.toBeNull();
    if (
      dialogBox === null ||
      browseButtonBox === null ||
      supportCardBox === null ||
      bilibiliCardBox === null ||
      supportButtonBox === null ||
      bilibiliButtonBox === null
    ) {
      throw new Error("Settings support entry did not expose visible bounds");
    }
    expect(supportCardBox.x).toBeGreaterThanOrEqual(dialogBox.x);
    expect(supportCardBox.x + supportCardBox.width).toBeLessThanOrEqual(
      dialogBox.x + dialogBox.width,
    );
    expect(supportButtonBox.x + supportButtonBox.width).toBeLessThanOrEqual(
      supportCardBox.x + supportCardBox.width,
    );
    expect(bilibiliButtonBox.x + bilibiliButtonBox.width).toBeLessThanOrEqual(
      bilibiliCardBox.x + bilibiliCardBox.width,
    );
    expect(supportCardBox.height).toBe(bilibiliCardBox.height);
    expect(browseButtonBox.x).toBe(supportButtonBox.x);
    expect(supportButtonBox.x).toBe(bilibiliButtonBox.x);
    expect(browseButtonBox.width).toBe(supportButtonBox.width);
    expect(supportButtonBox.width).toBe(bilibiliButtonBox.width);

    await page.screenshot({ path: join(screenshotRoot, "settings-support-1280x720.png") });
  } finally {
    await application.close();
    await rm(runtimeRoot, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
  }
});

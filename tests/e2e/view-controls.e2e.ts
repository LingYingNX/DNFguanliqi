import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("switches real library items between stable grid and list views", async () => {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const runtimeRoot = await mkdtemp(join(tmpdir(), "dnf-view-controls-e2e-"));
  const libraryRoot = join(runtimeRoot, "patch-categories");
  const childRoot = join(libraryRoot, "Armor");
  const nestedRoot = join(childRoot, "Cloth");
  const screenshotRoot = join(projectRoot, ".scratch");
  await Promise.all([
    mkdir(libraryRoot, { recursive: true }),
    mkdir(nestedRoot, { recursive: true }),
    mkdir(screenshotRoot, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(libraryRoot, "coat.npk"), "coat-payload"),
    writeFile(
      join(libraryRoot, "coat.png"),
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    ),
    writeFile(join(libraryRoot, "sword.npk"), "sword-payload"),
    writeFile(join(childRoot, "coat.npk"), "child-coat-payload"),
    writeFile(join(nestedRoot, "nested-coat.npk"), "nested-coat-payload"),
  ]);
  const application = await electron.launch({ args: [projectRoot], cwd: runtimeRoot });

  try {
    const page = await application.firstWindow();
    await page.setViewportSize({ width: 1280, height: 720 });
    const toolbarControls = [
      page.getByRole("button", { name: "设置" }),
      page.getByRole("button", { name: "调整外观" }),
      page.getByRole("button", { name: "新建子分类" }),
      page.locator(".workspace-search-field"),
      page.locator(".view-mode-control"),
      page.getByRole("checkbox", { name: "包含子分类" }),
    ];
    const toolbarBoxes = await Promise.all(toolbarControls.map((control) => control.boundingBox()));
    expect(toolbarBoxes.every((box) => box !== null)).toBe(true);
    const toolbarCenters = toolbarBoxes.map((box) => {
      if (box === null) {
        throw new Error("Top toolbar control did not expose a visible bounding box");
      }
      return box.y + box.height / 2;
    });
    expect(Math.max(...toolbarCenters) - Math.min(...toolbarCenters)).toBeLessThan(1);
    const items = page.getByRole("region", { name: "补丁项目" });
    await expect(items).toHaveAttribute("data-card-size", "medium");
    await expect(page.locator(".app-toolbar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "增大卡片" })).toHaveCount(0);
    const gridCard = page
      .locator(".item-grid .item-card")
      .filter({ has: page.locator(".item-preview-image") })
      .first();
    const gridCardBox = await gridCard.boundingBox();
    expect(gridCardBox).not.toBeNull();
    if (gridCardBox === null) {
      throw new Error("Grid card did not expose a visible bounding box");
    }
    expect(Math.abs(gridCardBox.width / gridCardBox.height - 4 / 3)).toBeLessThan(0.03);
    expect(gridCardBox.width).toBeGreaterThan(200);
    const beforeHoverBox = await gridCard.boundingBox();
    await gridCard.hover();
    await expect
      .poll(() => gridCard.evaluate((element) => getComputedStyle(element).borderColor))
      .toBe("rgb(91, 107, 255)");
    const afterHoverBox = await gridCard.boundingBox();
    expect(beforeHoverBox).not.toBeNull();
    expect(afterHoverBox).not.toBeNull();
    if (beforeHoverBox === null || afterHoverBox === null) {
      throw new Error("Grid card did not expose hover bounding boxes");
    }
    expect(Math.abs(afterHoverBox.y - beforeHoverBox.y)).toBeLessThan(0.5);
    const gridCardShell = gridCard.locator("xpath=..");
    const hoverZone = gridCardShell.locator(".item-preview-hover-zone");
    await expect(hoverZone).toBeVisible();
    const zoomImage = hoverZone.locator(".item-preview-hover-image");
    await page.mouse.move(gridCardBox.x + 2, gridCardBox.y + 2);
    await expect(zoomImage).toBeVisible();
    await expect
      .poll(() => zoomImage.evaluate((element) => (element as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        zoomImage.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)),
      )
      .toBeGreaterThan(0.99);
    const zoomBox = await zoomImage.boundingBox();
    expect(zoomBox).not.toBeNull();
    if (zoomBox === null) {
      throw new Error("Preview zoom did not expose a visible bounding box");
    }
    const gridZoomStyle = await zoomImage.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).width),
    );
    const zoomStyle = await zoomImage.evaluate((element) => {
      const image = element as HTMLImageElement;
      const computed = getComputedStyle(element);
      return {
        naturalRatio: image.naturalWidth / image.naturalHeight,
        transitionDuration: computed.transitionDuration,
        transitionProperty: computed.transitionProperty,
      };
    });
    expect(Math.abs(zoomBox.width / zoomBox.height - zoomStyle.naturalRatio)).toBeLessThan(0.03);
    expect(zoomStyle.transitionProperty).toContain("transform");
    expect(zoomStyle.transitionDuration).not.toContain("0s");
    expect(zoomBox.width).toBeGreaterThan(gridCardBox.width * 1.9);
    expect(zoomBox.width).toBeLessThan(gridCardBox.width * 2.1);
    const afterZoomCardBox = await gridCard.boundingBox();
    expect(afterZoomCardBox).not.toBeNull();
    if (afterZoomCardBox === null) {
      throw new Error("Grid card disappeared while preview zoom was visible");
    }
    expect(Math.abs(afterZoomCardBox.width - gridCardBox.width)).toBeLessThan(0.5);
    await page.mouse.move(0, 0);
    await expect(zoomImage).toBeHidden();
    await gridCard.click();
    await expect
      .poll(() => gridCard.evaluate((element) => getComputedStyle(element).borderColor))
      .toBe("rgb(245, 213, 71)");
    const previewBox = await gridCard.locator(".item-preview").boundingBox();
    const bodyBox = await gridCard.locator(".item-card-body").boundingBox();
    expect(previewBox).not.toBeNull();
    expect(bodyBox).not.toBeNull();
    if (previewBox === null || bodyBox === null) {
      throw new Error("Grid card preview or body did not expose a visible bounding box");
    }
    expect(previewBox.height).toBeGreaterThan(gridCardBox.height * 0.6);
    expect(previewBox.height).toBeLessThan(gridCardBox.height * 0.8);
    expect(bodyBox.height).toBeGreaterThan(0);
    expect(bodyBox.height).toBeLessThan(60);
    await expect
      .poll(() => gridCard.evaluate((element) => getComputedStyle(element).fontFamily))
      .toContain("Microsoft YaHei");
    await expect(gridCard.locator(".status-badge")).toHaveCount(0);
    const titleBox = await gridCard.locator(".item-title").boundingBox();
    const metaBox = await gridCard.locator(".item-meta").boundingBox();
    const dateBox = await gridCard.locator(".item-date").boundingBox();
    expect(titleBox).not.toBeNull();
    expect(metaBox).not.toBeNull();
    expect(dateBox).not.toBeNull();
    if (titleBox === null || metaBox === null || dateBox === null) {
      throw new Error("Grid card text did not expose visible bounding boxes");
    }
    expect(titleBox.y).toBeLessThan(metaBox.y);
    expect(Math.abs(metaBox.y - dateBox.y)).toBeLessThan(2);
    await expect(page.locator(".selection-indicator")).toHaveCount(0);
    const switchBox = await page
      .locator(".item-grid .item-card-shell .switch")
      .first()
      .boundingBox();
    expect(dateBox).not.toBeNull();
    expect(switchBox).not.toBeNull();
    if (dateBox === null || switchBox === null) {
      throw new Error("Grid card metadata or switch did not expose a visible bounding box");
    }
    expect(switchBox.width).toBeLessThan(40);
    expect(switchBox.height).toBeLessThan(24);
    const overlaps =
      dateBox.x < switchBox.x + switchBox.width &&
      dateBox.x + dateBox.width > switchBox.x &&
      dateBox.y < switchBox.y + switchBox.height &&
      dateBox.y + dateBox.height > switchBox.y;
    expect(
      overlaps,
      `metadata ${JSON.stringify(dateBox)} overlaps switch ${JSON.stringify(switchBox)}`,
    ).toBe(false);
    await page.screenshot({ path: join(screenshotRoot, "task-8-grid-1280.png") });

    await page.getByRole("button", { name: "列表视图" }).click();
    await expect(page.getByRole("columnheader", { name: "名称" })).toHaveCount(0);
    const listCard = page
      .locator(".item-list .item-card")
      .filter({ has: page.locator(".item-preview-image") })
      .first();
    const listShell = listCard.locator("xpath=..");
    await expect(listCard.locator(".status-badge")).toHaveCount(0);
    await listCard.hover();
    await listShell.locator(".item-preview-hover-zone").hover();
    const listZoomImage = listShell.locator(".item-preview-hover-image");
    await expect(listZoomImage).toBeVisible();
    await expect
      .poll(() =>
        listZoomImage.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)),
      )
      .toBeGreaterThan(0.99);
    const listZoomBox = await listZoomImage.boundingBox();
    expect(listZoomBox).not.toBeNull();
    if (listZoomBox === null) {
      throw new Error("List preview zoom did not expose a visible bounding box");
    }
    const listZoomStyle = await listZoomImage.evaluate((element) => {
      const image = element as HTMLImageElement;
      const computed = getComputedStyle(element);
      return {
        naturalRatio: image.naturalWidth / image.naturalHeight,
        width: Number.parseFloat(computed.width),
      };
    });
    expect(Math.abs(listZoomStyle.width - gridZoomStyle)).toBeLessThan(1);
    expect(Math.abs(listZoomBox.width - zoomBox.width)).toBeLessThan(1);
    expect(listZoomBox.width).toBeGreaterThan(0);
    expect(
      Math.abs(listZoomBox.width / listZoomBox.height - listZoomStyle.naturalRatio),
    ).toBeLessThan(0.03);
    await page.screenshot({ path: join(screenshotRoot, "task-8-list-1280.png") });

    await page.getByRole("button", { name: "Armor", exact: true }).click();
    await expect(page.getByRole("button", { name: "coat.npk", exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: "包含子分类" }).check();
    const descendant = page.getByRole("button", {
      name: "nested-coat.npk - Armor\\Cloth\\nested-coat.npk",
    });
    await expect(descendant).toBeVisible();
    await expect(descendant).toContainText("Cloth");
    await page.screenshot({ path: join(screenshotRoot, "task-8-descendants-1280.png") });
    await page.getByRole("checkbox", { name: "包含子分类" }).uncheck();
    await expect(descendant).toHaveCount(0);
  } finally {
    await application.close();
    await rm(runtimeRoot, { force: true, recursive: true, maxRetries: 5, retryDelay: 100 });
  }
});

import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createManagedImageAssets,
  resolveManagedAssetPath,
  resolveManagedAssetUrl,
} from "../../src/core/assets/managed-image-assets";

const temporaryDirectories: string[] = [];
const assetId = "01234567-89ab-4cde-8fab-0123456789ab";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function createFixture(): Promise<{
  readonly assetsRoot: string;
  readonly sourceRoot: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "dnf-managed-images-"));
  temporaryDirectories.push(root);
  const assetsRoot = join(root, "managed");
  const sourceRoot = join(root, "sources");
  await Promise.all([mkdir(assetsRoot), mkdir(sourceRoot)]);
  return { assetsRoot, sourceRoot };
}

describe("managed image assets", () => {
  it.each(["png", "jpg", "jpeg", "webp", "bmp", "gif"])(
    "copies a %s source exclusively and preserves its bytes",
    async (extension) => {
      const { assetsRoot, sourceRoot } = await createFixture();
      const source = join(sourceRoot, `source.${extension.toUpperCase()}`);
      await writeFile(source, `image-${extension}`);
      const assets = createManagedImageAssets({
        assetsRoot,
        createId: () => assetId,
        kind: "preview",
      });

      const result = await assets.copyFrom(source);

      expect(result).toEqual({
        ok: true,
        value: {
          assetName: `${assetId}.${extension}`,
          url: `dnf-asset://preview/${assetId}.${extension}`,
        },
      });
      expect(await readFile(source, "utf8")).toBe(`image-${extension}`);
      expect(await readFile(join(assetsRoot, `${assetId}.${extension}`), "utf8")).toBe(
        `image-${extension}`,
      );
    },
  );

  it("rejects unsupported sources without creating a managed file", async () => {
    const { assetsRoot, sourceRoot } = await createFixture();
    const source = join(sourceRoot, "source.svg");
    await writeFile(source, "svg");
    const assets = createManagedImageAssets({
      assetsRoot,
      createId: () => assetId,
      kind: "preview",
    });

    const result = await assets.copyFrom(source);

    expect(result).toEqual({ ok: false, error: { code: "UNSUPPORTED_IMAGE" } });
    await expect(access(join(assetsRoot, `${assetId}.svg`))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("does not overwrite a managed file when a generated name already exists", async () => {
    const { assetsRoot, sourceRoot } = await createFixture();
    const source = join(sourceRoot, "source.png");
    const target = join(assetsRoot, `${assetId}.png`);
    await Promise.all([writeFile(source, "source"), writeFile(target, "external")]);
    const assets = createManagedImageAssets({
      assetsRoot,
      createId: () => assetId,
      kind: "preview",
    });

    const result = await assets.copyFrom(source);

    expect(result).toEqual({ ok: false, error: { code: "ASSET_IO" } });
    expect(await readFile(target, "utf8")).toBe("external");
  });

  it("removes only parsed managed names and rejects path escape attempts", async () => {
    const { assetsRoot, sourceRoot } = await createFixture();
    const source = join(sourceRoot, "source.png");
    await writeFile(source, "source");
    const assets = createManagedImageAssets({
      assetsRoot,
      createId: () => assetId,
      kind: "wallpaper",
    });
    await assets.copyFrom(source);

    expect(await assets.remove(`${assetId}.png`)).toEqual({ ok: true, value: undefined });
    await expect(access(join(assetsRoot, `${assetId}.png`))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await assets.remove("..\\outside.png")).toEqual({
      ok: false,
      error: { code: "ASSET_NAME_INVALID" },
    });
    expect(resolveManagedAssetPath(assetsRoot, "..\\outside.png")).toEqual({
      ok: false,
      error: { code: "ASSET_NAME_INVALID" },
    });
  });

  it("resolves only preview and wallpaper protocol URLs to their managed roots", async () => {
    const { assetsRoot } = await createFixture();
    const wallpaperRoot = join(assetsRoot, "wallpapers");
    const previewRoot = join(assetsRoot, "previews");
    const roots = { previewRoot, wallpaperRoot };

    expect(resolveManagedAssetUrl(roots, `dnf-asset://preview/${assetId}.png`)).toEqual({
      ok: true,
      value: join(previewRoot, `${assetId}.png`),
    });
    expect(resolveManagedAssetUrl(roots, `dnf-asset://wallpaper/${assetId}.jpg`)).toEqual({
      ok: true,
      value: join(wallpaperRoot, `${assetId}.jpg`),
    });
    expect(resolveManagedAssetUrl(roots, `dnf-asset://other/${assetId}.png`)).toEqual({
      ok: false,
      error: { code: "ASSET_URL_INVALID" },
    });
    expect(resolveManagedAssetUrl(roots, `dnf-asset://preview/folder/${assetId}.png`)).toEqual({
      ok: false,
      error: { code: "ASSET_URL_INVALID" },
    });
  });
});

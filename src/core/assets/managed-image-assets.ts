import { COPYFILE_EXCL } from "node:constants";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { win32 } from "node:path";
import { z } from "zod";
import { err, ok, type Result } from "../../shared/result";

const ImageExtensionSchema = z.union([
  z.literal(".png"),
  z.literal(".jpg"),
  z.literal(".jpeg"),
  z.literal(".webp"),
  z.literal(".bmp"),
  z.literal(".gif"),
]);
const AssetNameSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpe?g|webp|bmp|gif)$/u,
  );

type ManagedAssetKind = "preview" | "wallpaper";

export type ManagedImageError =
  | { readonly code: "UNSUPPORTED_IMAGE" }
  | { readonly code: "ASSET_NAME_INVALID" }
  | { readonly code: "ASSET_URL_INVALID" }
  | { readonly code: "ASSET_IO" };

export type ManagedImageAssets = {
  readonly copyFrom: (
    sourcePath: string,
  ) => Promise<Result<{ readonly assetName: string; readonly url: string }, ManagedImageError>>;
  readonly path: (assetName: string) => Result<string, ManagedImageError>;
  readonly remove: (assetName: string) => Promise<Result<void, ManagedImageError>>;
  readonly url: (assetName: string) => Result<string, ManagedImageError>;
};

type ManagedImageAssetsOptions = {
  readonly assetsRoot: string;
  readonly createId?: () => string;
  readonly kind: ManagedAssetKind;
};

export function resolveManagedAssetPath(
  assetsRoot: string,
  assetName: string,
): Result<string, ManagedImageError> {
  const parsed = AssetNameSchema.safeParse(assetName);
  if (!parsed.success) return err({ code: "ASSET_NAME_INVALID" });
  return ok(win32.join(assetsRoot, parsed.data));
}

export function resolveManagedAssetUrl(
  roots: { readonly previewRoot: string; readonly wallpaperRoot: string },
  value: string,
): Result<string, ManagedImageError> {
  try {
    const url = new URL(value);
    if (url.protocol !== "dnf-asset:" || url.search !== "" || url.hash !== "") {
      return err({ code: "ASSET_URL_INVALID" });
    }
    const assetName = decodeURIComponent(url.pathname.slice(1));
    if (assetName === "" || assetName.includes("/") || assetName.includes("\\")) {
      return err({ code: "ASSET_URL_INVALID" });
    }
    const root =
      url.hostname === "preview"
        ? roots.previewRoot
        : url.hostname === "wallpaper"
          ? roots.wallpaperRoot
          : null;
    if (root === null) return err({ code: "ASSET_URL_INVALID" });
    const resolved = resolveManagedAssetPath(root, assetName);
    return resolved.ok ? resolved : err({ code: "ASSET_URL_INVALID" });
  } catch (error) {
    if (error instanceof Error) return err({ code: "ASSET_URL_INVALID" });
    throw error;
  }
}

export function createManagedImageAssets(options: ManagedImageAssetsOptions): ManagedImageAssets {
  const createId = options.createId ?? randomUUID;
  const url = (assetName: string): Result<string, ManagedImageError> => {
    const resolved = resolveManagedAssetPath(options.assetsRoot, assetName);
    return resolved.ok ? ok(`dnf-asset://${options.kind}/${assetName}`) : resolved;
  };

  return {
    async copyFrom(sourcePath) {
      const extension = ImageExtensionSchema.safeParse(
        win32.extname(sourcePath).toLocaleLowerCase(),
      );
      if (!extension.success) return err({ code: "UNSUPPORTED_IMAGE" });
      const assetName = `${createId()}${extension.data}`;
      const target = resolveManagedAssetPath(options.assetsRoot, assetName);
      if (!target.ok) return target;
      try {
        await mkdir(options.assetsRoot, { recursive: true });
        await copyFile(sourcePath, target.value, COPYFILE_EXCL);
        return ok({ assetName, url: `dnf-asset://${options.kind}/${assetName}` });
      } catch (error) {
        if (error instanceof Error) return err({ code: "ASSET_IO" });
        throw error;
      }
    },
    async remove(assetName) {
      const target = resolveManagedAssetPath(options.assetsRoot, assetName);
      if (!target.ok) return target;
      try {
        await rm(target.value);
        return ok(undefined);
      } catch (error) {
        if (error instanceof Error) return err({ code: "ASSET_IO" });
        throw error;
      }
    },
    path: (assetName) => resolveManagedAssetPath(options.assetsRoot, assetName),
    url,
  };
}

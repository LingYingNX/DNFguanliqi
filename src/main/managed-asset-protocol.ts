import { readFile } from "node:fs/promises";
import { win32 } from "node:path";
import { protocol } from "electron";
import { resolveManagedAssetUrl } from "../core/assets/managed-image-assets";
import { readLibraryPreviewFile } from "../core/library/library-preview";
import type { AppPaths } from "./app-paths";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "dnf-asset",
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  },
  {
    scheme: "dnf-library",
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  },
]);

export function registerManagedAssetProtocol(paths: AppPaths): void {
  const roots = {
    previewRoot: win32.join(paths.dataRoot, "previews"),
    wallpaperRoot: win32.join(paths.dataRoot, "wallpapers"),
  };
  protocol.handle("dnf-asset", async (request) => {
    const resolved = resolveManagedAssetUrl(roots, request.url);
    if (!resolved.ok) return new Response(null, { status: 404 });
    try {
      const extension = win32.extname(resolved.value).slice(1).toLocaleLowerCase();
      const mime = extension === "jpg" ? "jpeg" : extension;
      return new Response(await readFile(resolved.value), {
        headers: { "Content-Type": `image/${mime}` },
      });
    } catch (error) {
      if (error instanceof Error) return new Response(null, { status: 404 });
      throw error;
    }
  });
}

export function registerLibraryPreviewProtocol(paths: AppPaths): void {
  protocol.handle("dnf-library", async (request) => {
    const preview = await readLibraryPreviewFile(paths.libraryRoot, request.url);
    if (!preview.ok) return new Response(null, { status: 404 });
    return new Response(new Uint8Array(preview.value.data), {
      headers: { "Content-Type": preview.value.contentType },
    });
  });
}

import { copyFile, readdir, readFile, rm } from "node:fs/promises";
import { win32 } from "node:path";
import type { LibraryRoot } from "../../main/app-paths";
import { err, ok, type Result } from "../../shared/result";
import { type LibraryPathError, resolveLibraryPath } from "../paths/library-path";

export const LIBRARY_PREVIEW_EXTENSIONS = new Set([
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);

export type LibraryPreviewError =
  | LibraryPathError
  | { readonly code: "UNSUPPORTED_IMAGE" }
  | { readonly code: "LIBRARY_IO"; readonly relativePath: string };

export type LibraryPreviewUrlError = {
  readonly code: "LIBRARY_PREVIEW_URL_INVALID";
};

export type LibraryPreviewReadError =
  | LibraryPreviewUrlError
  | { readonly code: "LIBRARY_PREVIEW_NOT_FOUND" };

export type CopyLibraryPreviewRequest = {
  readonly libraryRoot: LibraryRoot;
  readonly kind: "patch" | "group";
  readonly relativePath: string;
  readonly sourcePath: string;
};

function itemBaseName(kind: CopyLibraryPreviewRequest["kind"], relativePath: string): string {
  const itemName = win32.basename(relativePath);
  return kind === "patch" ? win32.basename(itemName, win32.extname(itemName)) : itemName;
}

export function findMatchingPreview(fileNames: readonly string[], baseName: string): string | null {
  const normalizedBaseName = baseName.toLocaleLowerCase();
  return (
    fileNames.find((name) => {
      const extension = win32.extname(name).toLocaleLowerCase();
      return (
        LIBRARY_PREVIEW_EXTENSIONS.has(extension) &&
        win32.basename(name, win32.extname(name)).toLocaleLowerCase() === normalizedBaseName
      );
    }) ?? null
  );
}

export function libraryPreviewUrl(relativePath: string, version?: bigint): string {
  const suffix = version === undefined ? "" : `?v=${encodeURIComponent(String(version))}`;
  return `dnf-library://library/${encodeURIComponent(relativePath.replaceAll("/", "\\"))}${suffix}`;
}

export function resolveLibraryPreviewUrl(
  libraryRoot: LibraryRoot,
  value: string,
): Result<string, LibraryPreviewUrlError> {
  try {
    const url = new URL(value);
    const version = url.searchParams.get("v");
    if (
      url.protocol !== "dnf-library:" ||
      url.hostname !== "library" ||
      url.username !== "" ||
      url.password !== "" ||
      url.port !== "" ||
      (url.search !== "" &&
        (url.searchParams.size !== 1 || version === null || !/^\d+$/u.test(version))) ||
      url.hash !== ""
    ) {
      return err({ code: "LIBRARY_PREVIEW_URL_INVALID" });
    }

    const encodedPath = url.pathname.slice(1);
    if (encodedPath === "" || encodedPath.includes("/")) {
      return err({ code: "LIBRARY_PREVIEW_URL_INVALID" });
    }
    const relativePath = decodeURIComponent(encodedPath);
    const extension = win32.extname(relativePath).toLocaleLowerCase();
    if (!LIBRARY_PREVIEW_EXTENSIONS.has(extension)) {
      return err({ code: "LIBRARY_PREVIEW_URL_INVALID" });
    }
    const resolved = resolveLibraryPath(libraryRoot, relativePath);
    return resolved.ok ? ok(resolved.value) : err({ code: "LIBRARY_PREVIEW_URL_INVALID" });
  } catch (error) {
    if (error instanceof Error) return err({ code: "LIBRARY_PREVIEW_URL_INVALID" });
    throw error;
  }
}

function imageContentType(path: string): string {
  const extension = win32.extname(path).toLocaleLowerCase();
  return extension === ".jpg" || extension === ".jpeg"
    ? "image/jpeg"
    : `image/${extension.slice(1)}`;
}

export async function readLibraryPreviewFile(
  libraryRoot: LibraryRoot,
  value: string,
): Promise<
  Result<{ readonly data: Buffer; readonly contentType: string }, LibraryPreviewReadError>
> {
  const resolved = resolveLibraryPreviewUrl(libraryRoot, value);
  if (!resolved.ok) return resolved;
  try {
    return ok({
      data: await readFile(resolved.value),
      contentType: imageContentType(resolved.value),
    });
  } catch (error) {
    if (error instanceof Error) return err({ code: "LIBRARY_PREVIEW_NOT_FOUND" });
    throw error;
  }
}

export async function copyLibraryPreview(
  request: CopyLibraryPreviewRequest,
): Promise<Result<{ readonly previewRelativePath: string }, LibraryPreviewError>> {
  const sourceExtension = win32.extname(request.sourcePath).toLocaleLowerCase();
  if (!LIBRARY_PREVIEW_EXTENSIONS.has(sourceExtension)) {
    return err({ code: "UNSUPPORTED_IMAGE" });
  }

  const directoryRelativePath =
    request.kind === "patch" ? win32.dirname(request.relativePath) : request.relativePath;
  const directory = resolveLibraryPath(request.libraryRoot, directoryRelativePath);
  if (!directory.ok) return directory;

  const baseName = itemBaseName(request.kind, request.relativePath);
  const previewRelativePath = win32.join(directoryRelativePath, `${baseName}${sourceExtension}`);
  const target = resolveLibraryPath(request.libraryRoot, previewRelativePath);
  if (!target.ok) return target;
  const targetName = win32.basename(previewRelativePath).toLocaleLowerCase();

  try {
    await copyFile(request.sourcePath, target.value);
    const entries = await readdir(directory.value, { withFileTypes: true });
    await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name.toLocaleLowerCase() !== targetName &&
            findMatchingPreview([entry.name], baseName) !== null,
        )
        .map((entry) => rm(win32.join(directory.value, entry.name), { force: true })),
    );
    return ok({ previewRelativePath });
  } catch (error) {
    if (error instanceof Error) {
      return err({ code: "LIBRARY_IO", relativePath: request.relativePath });
    }
    throw error;
  }
}

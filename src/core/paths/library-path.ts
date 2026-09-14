import { existsSync, realpathSync } from "node:fs";
import { win32 } from "node:path";
import { z } from "zod";
import type { LibraryRoot } from "../../main/app-paths";
import { err, ok, type Result } from "../../shared/result";

const LibraryPathSchema = z.string().min(1).brand<"LibraryPath">();

export type LibraryPath = z.infer<typeof LibraryPathSchema>;

export type LibraryPathError = {
  readonly code: "PATH_OUTSIDE_LIBRARY";
  readonly relativePath: string;
};

function nearestExistingPath(path: string): string {
  let current = path;
  while (!existsSync(current)) {
    const parent = win32.dirname(current);
    if (parent === current) {
      return current;
    }
    current = parent;
  }
  return current;
}

export function resolveLibraryPath(
  libraryRoot: LibraryRoot,
  relativePath: string,
): Result<LibraryPath, LibraryPathError> {
  if (win32.isAbsolute(relativePath)) {
    return err({ code: "PATH_OUTSIDE_LIBRARY", relativePath });
  }

  const candidate = win32.resolve(libraryRoot, relativePath);
  const relativeToRoot = win32.relative(libraryRoot, candidate);
  if (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${win32.sep}`) ||
    win32.isAbsolute(relativeToRoot)
  ) {
    return err({ code: "PATH_OUTSIDE_LIBRARY", relativePath });
  }

  if (existsSync(libraryRoot)) {
    const rootOnDisk = realpathSync.native(libraryRoot);
    const existingAncestor = nearestExistingPath(candidate);
    const ancestorOnDisk = realpathSync.native(existingAncestor);
    const diskRelative = win32.relative(rootOnDisk, ancestorOnDisk);
    if (
      diskRelative === ".." ||
      diskRelative.startsWith(`..${win32.sep}`) ||
      win32.isAbsolute(diskRelative)
    ) {
      return err({ code: "PATH_OUTSIDE_LIBRARY", relativePath });
    }
  }

  return ok(LibraryPathSchema.parse(candidate));
}

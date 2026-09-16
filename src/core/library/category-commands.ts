import { lstat, mkdir, readdir, rename, rm, rmdir } from "node:fs/promises";
import { win32 } from "node:path";
import type { LibraryRoot } from "../../main/app-paths";
import { isPathWithinKey } from "../../shared/path-key";
import { err, ok, type Result } from "../../shared/result";
import { pathExists } from "../filesystem/path-exists";
import { type LibraryPathError, resolveLibraryPath } from "../paths/library-path";
import { parentRelativePath } from "../paths/relative-path";
import { readGroupMarker } from "./group-marker";
import { LibraryItemNameSchema } from "./library-item-name";

export type CategoryCommandError =
  | LibraryPathError
  | { readonly code: "INVALID_ITEM_NAME" }
  | { readonly code: "INVALID_CATEGORY_PATH"; readonly relativePath: string }
  | { readonly code: "TARGET_CONFLICT"; readonly relativePath: string }
  | { readonly code: "CATEGORY_NOT_EMPTY"; readonly relativePath: string }
  | { readonly code: "CATEGORY_TYPE_MISMATCH"; readonly relativePath: string }
  | { readonly code: "LIBRARY_IO" };

export interface CategoryCommands {
  create(request: {
    readonly parentRelativePath: string;
    readonly name: string;
  }): Promise<Result<{ readonly relativePath: string }, CategoryCommandError>>;
  rename(request: {
    readonly relativePath: string;
    readonly name: string;
  }): Promise<Result<{ readonly relativePath: string }, CategoryCommandError>>;
  remove(request: {
    readonly relativePath: string;
    readonly allowNonEmpty?: boolean;
  }): Promise<Result<{ readonly relativePath: string }, CategoryCommandError>>;
  move(request: {
    readonly sourceRelativePath: string;
    readonly targetParentRelativePath: string;
  }): Promise<Result<{ readonly relativePath: string }, CategoryCommandError>>;
}

function parseName(name: string): Result<string, CategoryCommandError> {
  const parsed = LibraryItemNameSchema.safeParse(name);
  return parsed.success ? ok(parsed.data) : err({ code: "INVALID_ITEM_NAME" });
}

async function isCategory(path: string): Promise<boolean> {
  const metadata = await lstat(path);
  return metadata.isDirectory() && (await readGroupMarker(path)) === null;
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = win32.normalize(relativePath.replaceAll("/", "\\"));
  return normalized === "." ? "" : normalized;
}

function isPathWithin(relativePath: string, parentRelativePath: string): boolean {
  return isPathWithinKey(
    normalizeRelativePath(relativePath).toLocaleLowerCase(),
    normalizeRelativePath(parentRelativePath).toLocaleLowerCase(),
  );
}

export function createCategoryCommands(libraryRoot: LibraryRoot): CategoryCommands {
  return {
    async create(request) {
      const name = parseName(request.name);
      if (!name.ok) return name;
      const parent = resolveLibraryPath(libraryRoot, request.parentRelativePath);
      if (!parent.ok) return parent;
      const relativePath = win32.join(request.parentRelativePath, name.value);
      const target = resolveLibraryPath(libraryRoot, relativePath);
      if (!target.ok) return target;
      try {
        if (!(await isCategory(parent.value))) {
          return err({
            code: "CATEGORY_TYPE_MISMATCH",
            relativePath: request.parentRelativePath,
          });
        }
        if (await pathExists(target.value)) return err({ code: "TARGET_CONFLICT", relativePath });
        await mkdir(target.value);
        return ok({ relativePath });
      } catch (error) {
        if (error instanceof Error) return err({ code: "LIBRARY_IO" });
        throw error;
      }
    },

    async rename(request) {
      if (request.relativePath === "") {
        return err({ code: "INVALID_CATEGORY_PATH", relativePath: request.relativePath });
      }
      const name = parseName(request.name);
      if (!name.ok) return name;
      const source = resolveLibraryPath(libraryRoot, request.relativePath);
      if (!source.ok) return source;
      const relativePath = win32.join(win32.dirname(request.relativePath), name.value);
      const target = resolveLibraryPath(libraryRoot, relativePath);
      if (!target.ok) return target;
      try {
        if (!(await isCategory(source.value))) {
          return err({ code: "CATEGORY_TYPE_MISMATCH", relativePath: request.relativePath });
        }
        if (await pathExists(target.value)) return err({ code: "TARGET_CONFLICT", relativePath });
        await rename(source.value, target.value);
        return ok({ relativePath });
      } catch (error) {
        if (error instanceof Error) return err({ code: "LIBRARY_IO" });
        throw error;
      }
    },

    async remove(request) {
      if (request.relativePath === "") {
        return err({ code: "INVALID_CATEGORY_PATH", relativePath: request.relativePath });
      }
      const target = resolveLibraryPath(libraryRoot, request.relativePath);
      if (!target.ok) return target;
      try {
        if (!(await isCategory(target.value))) {
          return err({ code: "CATEGORY_TYPE_MISMATCH", relativePath: request.relativePath });
        }
        if ((await readdir(target.value)).length > 0 && !request.allowNonEmpty) {
          return err({ code: "CATEGORY_NOT_EMPTY", relativePath: request.relativePath });
        }
        if (request.allowNonEmpty) await rm(target.value, { force: true, recursive: true });
        else await rmdir(target.value);
        return ok({ relativePath: request.relativePath });
      } catch (error) {
        if (error instanceof Error) return err({ code: "LIBRARY_IO" });
        throw error;
      }
    },

    async move(request) {
      const sourceRelativePath = normalizeRelativePath(request.sourceRelativePath);
      const targetParentRelativePath = normalizeRelativePath(request.targetParentRelativePath);
      if (sourceRelativePath === "" || isPathWithin(targetParentRelativePath, sourceRelativePath)) {
        return err({ code: "INVALID_CATEGORY_PATH", relativePath: request.sourceRelativePath });
      }
      const sourceParentPath = parentRelativePath(sourceRelativePath);
      const targetRelativePath = win32.join(
        targetParentRelativePath,
        win32.basename(sourceRelativePath),
      );
      if (targetRelativePath.toLocaleLowerCase() === sourceRelativePath.toLocaleLowerCase()) {
        return err({ code: "INVALID_CATEGORY_PATH", relativePath: request.sourceRelativePath });
      }
      const source = resolveLibraryPath(libraryRoot, sourceRelativePath);
      if (!source.ok) return source;
      const sourceParent = resolveLibraryPath(libraryRoot, sourceParentPath);
      if (!sourceParent.ok) return sourceParent;
      const targetParent = resolveLibraryPath(libraryRoot, targetParentRelativePath);
      if (!targetParent.ok) return targetParent;
      const target = resolveLibraryPath(libraryRoot, targetRelativePath);
      if (!target.ok) return target;
      try {
        if (!(await isCategory(source.value))) {
          return err({ code: "CATEGORY_TYPE_MISMATCH", relativePath: sourceRelativePath });
        }
        if (!(await isCategory(sourceParent.value))) {
          return err({ code: "CATEGORY_TYPE_MISMATCH", relativePath: sourceParentPath });
        }
        if (!(await isCategory(targetParent.value))) {
          return err({
            code: "CATEGORY_TYPE_MISMATCH",
            relativePath: targetParentRelativePath,
          });
        }
        if (await pathExists(target.value)) {
          return err({ code: "TARGET_CONFLICT", relativePath: targetRelativePath });
        }
        await rename(source.value, target.value);
        return ok({ relativePath: targetRelativePath });
      } catch (error) {
        if (error instanceof Error) return err({ code: "LIBRARY_IO" });
        throw error;
      }
    },
  };
}

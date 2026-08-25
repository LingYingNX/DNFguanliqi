import type { Dispatch, SetStateAction } from "react";
import type { DnfApi, MoveCategoryRequest } from "../../shared/ipc-contracts";
import type { Notice } from "./model";

type CategoryCommandsContext = {
  readonly categoryPath: string;
  readonly client: DnfApi | undefined;
  readonly scan: (relativePath: string) => Promise<boolean>;
  readonly scanNavigation: (relativePath: string) => Promise<boolean>;
  readonly setCategoryPath: Dispatch<SetStateAction<string>>;
  readonly setNotice: Dispatch<SetStateAction<Notice | null>>;
};

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replaceAll("/", "\\").toLocaleLowerCase();
}

function isPathWithin(relativePath: string, parentRelativePath: string): boolean {
  const path = normalizeRelativePath(relativePath);
  const parent = normalizeRelativePath(parentRelativePath);
  return path === parent || path.startsWith(`${parent}\\`);
}

function relocatePath(
  relativePath: string,
  sourceRelativePath: string,
  targetRelativePath: string,
): string {
  const source = sourceRelativePath.replaceAll("/", "\\");
  const path = relativePath.replaceAll("/", "\\");
  return path.toLocaleLowerCase() === source.toLocaleLowerCase()
    ? targetRelativePath
    : `${targetRelativePath}${path.slice(source.length)}`;
}

export function useCategoryCommands({
  categoryPath,
  client,
  scan,
  scanNavigation,
  setCategoryPath,
  setNotice,
}: CategoryCommandsContext) {
  const createCategory = async (name: string): Promise<boolean> => {
    if (client === undefined) return false;
    try {
      const result = await client.createCategory({ parentRelativePath: categoryPath, name });
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return false;
      }
      if (!(await scan(categoryPath))) return false;
      await scanNavigation("");
      return true;
    } catch {
      setNotice({ tone: "error", message: "创建分类失败，补丁库未被修改。" });
      return false;
    }
  };

  const renameCategory = async (name: string): Promise<boolean> => {
    if (client === undefined || categoryPath === "") return false;
    try {
      const result = await client.renameCategory({ relativePath: categoryPath, name });
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return false;
      }
      setCategoryPath(result.value.relativePath);
      await scanNavigation("");
      return true;
    } catch {
      setNotice({ tone: "error", message: "重命名分类失败，补丁库未被修改。" });
      return false;
    }
  };

  const deleteCategory = async (): Promise<boolean> => {
    if (client === undefined || categoryPath === "") return false;
    try {
      const result = await client.deleteCategory({ relativePath: categoryPath, confirmed: true });
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return false;
      }
      const separatorIndex = Math.max(
        categoryPath.lastIndexOf("\\"),
        categoryPath.lastIndexOf("/"),
      );
      setCategoryPath(separatorIndex < 0 ? "" : categoryPath.slice(0, separatorIndex));
      await scanNavigation("");
      return true;
    } catch {
      setNotice({ tone: "error", message: "删除分类失败，补丁库未被修改。" });
      return false;
    }
  };

  const moveCategory = async (request: MoveCategoryRequest): Promise<boolean> => {
    if (client === undefined || client.moveCategory === undefined) return false;
    try {
      const result = await client.moveCategory(request);
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return false;
      }
      if (categoryPath !== "" && isPathWithin(categoryPath, request.sourceRelativePath)) {
        setCategoryPath(
          relocatePath(categoryPath, request.sourceRelativePath, result.value.relativePath),
        );
      } else if (categoryPath !== "" && !(await scan(categoryPath))) {
        return false;
      }
      if (!(await scanNavigation(""))) return false;
      return true;
    } catch {
      setNotice({ tone: "error", message: "移动分类失败，补丁库未被修改。" });
      return false;
    }
  };

  return { createCategory, deleteCategory, moveCategory, renameCategory };
}

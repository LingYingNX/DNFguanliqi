import type { Dispatch, SetStateAction } from "react";
import type { DnfApi } from "../../shared/ipc-contracts";
import type { Notice } from "./model";

type CategoryCommandsContext = {
  readonly categoryPath: string;
  readonly client: DnfApi | undefined;
  readonly scan: (relativePath: string) => Promise<boolean>;
  readonly scanNavigation: (relativePath: string) => Promise<boolean>;
  readonly setCategoryPath: Dispatch<SetStateAction<string>>;
  readonly setNotice: Dispatch<SetStateAction<Notice | null>>;
};

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
      setNotice({ tone: "success", message: `已创建分类 ${name}` });
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
      setNotice({ tone: "success", message: `已重命名分类为 ${name}` });
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
      setNotice({ tone: "success", message: "已删除空分类" });
      return true;
    } catch {
      setNotice({ tone: "error", message: "删除分类失败，补丁库未被修改。" });
      return false;
    }
  };

  return { createCategory, deleteCategory, renameCategory };
}

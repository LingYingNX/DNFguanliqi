import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DnfApi, RecycleEntryDto } from "../../shared/ipc-contracts";
import type { CategorySnapshot } from "../../shared/library-dto";
import { type EnabledFilter, itemMatches, type Notice, type WorkspaceItem } from "./model";
import { useCategoryCommands } from "./useCategoryCommands";

export function useWorkspace(client: DnfApi | undefined) {
  const [categoryPath, setCategoryPath] = useState("");
  const [navigationSnapshot, setNavigationSnapshot] = useState<CategorySnapshot | null>(null);
  const [snapshot, setSnapshot] = useState<CategorySnapshot | null>(null);
  const [query, setQuery] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");
  const [includeDescendants, setIncludeDescendants] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [recycleEntries, setRecycleEntries] = useState<readonly RecycleEntryDto[]>([]);
  const scanSequence = useRef(0);
  const snapshotPath = useRef<string | null>(null);

  const scan = useCallback(
    async (relativePath: string): Promise<boolean> => {
      const sequence = scanSequence.current + 1;
      scanSequence.current = sequence;
      setLoading(true);
      if (snapshotPath.current !== relativePath) setSnapshot(null);

      if (client === undefined) {
        setLoading(false);
        setNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
        return false;
      }

      try {
        const result = await client.scan({ includeDescendants, relativePath });
        if (sequence !== scanSequence.current) return false;
        if (result.ok) {
          setSnapshot(result.value);
          snapshotPath.current = relativePath;
          if (relativePath === "") {
            setNavigationSnapshot(result.value);
          }
          setNotice(null);
          return true;
        } else {
          setNotice({ tone: "error", message: result.error.message });
          return false;
        }
      } catch {
        if (sequence === scanSequence.current) {
          setNotice({ tone: "error", message: "扫描补丁库失败，磁盘内容未被修改。" });
        }
        return false;
      } finally {
        if (sequence === scanSequence.current) setLoading(false);
      }
    },
    [client, includeDescendants],
  );

  const scanNavigation = useCallback(
    async (relativePath: string): Promise<boolean> => {
      if (client === undefined) {
        setNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
        return false;
      }
      try {
        const result = await client.scan({ relativePath });
        if (!result.ok) {
          setNotice({ tone: "error", message: result.error.message });
          return false;
        }
        setNavigationSnapshot(result.value);
        setNotice(null);
        return true;
      } catch (error) {
        if (error instanceof Error) {
          setNotice({ tone: "error", message: "刷新分类顺序失败。" });
          return false;
        }
        throw error;
      }
    },
    [client],
  );

  useEffect(() => {
    void scan(categoryPath);
  }, [categoryPath, scan]);

  const items = useMemo<WorkspaceItem[]>(
    () => (snapshot === null ? [] : [...snapshot.groups, ...snapshot.patches]),
    [snapshot],
  );
  const visibleItems = useMemo(
    () => items.filter((item) => itemMatches(item, query.trim(), enabledFilter)),
    [enabledFilter, items, query],
  );

  const importPatches = async (): Promise<void> => {
    if (client === undefined) {
      setNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
      return;
    }

    try {
      const result = await client.importPatches({ categoryRelativePath: categoryPath });
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return;
      }
      if (result.value.importedCount === 0) {
        setNotice({ tone: "info", message: "未选择新的补丁文件。" });
        return;
      }

      const refreshed = await scan(categoryPath);
      if (!refreshed) {
        return;
      }
      setNotice({ tone: "success", message: `已导入 ${result.value.importedCount} 个补丁` });
    } catch {
      setNotice({ tone: "error", message: "导入补丁失败，磁盘内容未被修改。" });
    }
  };

  const importDroppedPatches = async (files: readonly File[]): Promise<void> => {
    if (client === undefined) {
      setNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
      return;
    }
    if (files.some((file) => !file.name.toLocaleLowerCase().endsWith(".npk"))) {
      setNotice({ tone: "error", message: "只能拖入 NPK 补丁文件。" });
      return;
    }
    try {
      const result = await client.importDroppedPatches({
        categoryRelativePath: categoryPath,
        files,
      });
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return;
      }
      if (await scan(categoryPath)) {
        setNotice({ tone: "success", message: `已导入 ${result.value.importedCount} 个补丁` });
      }
    } catch (error) {
      if (error instanceof Error) {
        setNotice({ tone: "error", message: "拖入补丁失败，磁盘内容未被修改。" });
        return;
      }
      throw error;
    }
  };

  const setCategoryOrder = async (
    parentRelativePath: string,
    orderedChildRelativePaths: readonly string[],
  ): Promise<boolean> => {
    if (client === undefined) {
      setNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
      return false;
    }
    try {
      const result = await client.setCategoryOrder({
        parentRelativePath,
        orderedChildRelativePaths: [...orderedChildRelativePaths],
      });
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return false;
      }
      return scanNavigation("");
    } catch (error) {
      if (error instanceof Error) {
        setNotice({ tone: "error", message: "保存分类顺序失败。" });
        return false;
      }
      throw error;
    }
  };

  const categoryCommands = useCategoryCommands({
    categoryPath,
    client,
    scan,
    scanNavigation,
    setCategoryPath,
    setNotice,
  });

  const refreshRecycle = useCallback(async (): Promise<boolean> => {
    if (client === undefined) {
      setNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
      return false;
    }
    try {
      const result = await client.listRecycle();
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return false;
      }
      setRecycleEntries(result.value.items);
      return true;
    } catch {
      setNotice({ tone: "error", message: "读取回收站失败。" });
      return false;
    }
  }, [client]);

  return {
    categoryPath,
    ...categoryCommands,
    enabledFilter,
    importPatches,
    importDroppedPatches,
    includeDescendants,
    items,
    loading,
    navigationSnapshot,
    notice,
    query,
    recycleEntries,
    refreshRecycle,
    refresh: () => scan(categoryPath),
    setCategoryPath,
    setCategoryOrder,
    setEnabledFilter,
    setIncludeDescendants,
    setQuery,
    showNotice: setNotice,
    snapshot,
    visibleItems,
  };
}

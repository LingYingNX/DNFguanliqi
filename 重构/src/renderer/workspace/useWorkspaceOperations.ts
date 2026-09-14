import type { DnfApi } from "../../shared/ipc-contracts";
import type { Notice, WorkspaceItem } from "./model";

type OperationContext = {
  readonly categoryPath: string;
  readonly clearSelection: () => void;
  readonly client: DnfApi | undefined;
  readonly refresh: () => Promise<boolean>;
  readonly refreshRecycle: () => Promise<boolean>;
  readonly selectedItems: readonly WorkspaceItem[];
  readonly showNotice: (notice: Notice) => void;
};

export function useWorkspaceOperations({
  categoryPath,
  clearSelection,
  client,
  refresh,
  refreshRecycle,
  selectedItems,
  showNotice,
}: OperationContext) {
  const reportFailure = (message: string): false => {
    showNotice({ tone: "error", message });
    return false;
  };

  const finish = async (message: string): Promise<boolean> => {
    if (!(await refresh())) {
      return false;
    }
    clearSelection();
    showNotice({ tone: "success", message });
    return true;
  };

  const withClient = (): DnfApi | null => {
    if (client === undefined) {
      reportFailure("桌面接口不可用，请重新启动应用。");
      return null;
    }
    return client;
  };

  const setEnabled = async (enabled: boolean): Promise<boolean> => {
    const api = withClient();
    const itemsToChange = selectedItems.filter((item) => item.enabled !== enabled);
    if (api === null || itemsToChange.length === 0) {
      return false;
    }
    try {
      const request = {
        items: itemsToChange.map((item) => ({ kind: item.kind, relativePath: item.relativePath })),
      };
      if (enabled) {
        const result = await api.enableItems(request);
        return result.ok
          ? finish(`已启用 ${result.value.installedCount} 个项目`)
          : reportFailure(result.error.message);
      }
      const result = await api.disableItems(request);
      return result.ok
        ? finish(`已停用 ${result.value.removedCount} 个项目`)
        : reportFailure(result.error.message);
    } catch (error) {
      if (error instanceof Error) {
        return reportFailure(`${enabled ? "启用" : "停用"}失败，磁盘内容未被修改。`);
      }
      throw error;
    }
  };

  const rename = async (newName: string): Promise<boolean> => {
    const api = withClient();
    const item = selectedItems[0];
    if (api === null || item === undefined || selectedItems.length !== 1) {
      return false;
    }
    try {
      const result = await api.moveItem({
        kind: item.kind,
        sourceRelativePath: item.relativePath,
        targetDirectoryRelativePath: categoryPath,
        newName,
      });
      return result.ok ? finish(`已重命名为 ${newName}`) : reportFailure(result.error.message);
    } catch (error) {
      if (error instanceof Error) {
        return reportFailure("重命名失败，磁盘内容未被修改。");
      }
      throw error;
    }
  };

  const move = async (targetDirectoryRelativePath: string): Promise<boolean> => {
    const api = withClient();
    if (api === null || selectedItems.length === 0) {
      return false;
    }
    try {
      const result = await api.moveItems({
        items: selectedItems.map((item) => ({
          kind: item.kind,
          sourceRelativePath: item.relativePath,
        })),
        targetDirectoryRelativePath,
      });
      return result.ok
        ? finish(`已移动 ${result.value.relativePaths.length} 个项目`)
        : reportFailure(result.error.message);
    } catch (error) {
      if (error instanceof Error) {
        return reportFailure("移动失败，磁盘内容未被修改。");
      }
      throw error;
    }
  };

  const createGroup = async (groupName: string): Promise<boolean> => {
    const api = withClient();
    const patches = selectedItems.filter((item) => item.kind === "patch");
    if (api === null || patches.length < 2 || patches.length !== selectedItems.length) {
      return false;
    }
    try {
      const result = await api.createGroup({
        categoryRelativePath: categoryPath,
        patchRelativePaths: patches.map((patch) => patch.relativePath),
        groupName,
      });
      return result.ok ? finish(`已创建补丁组 ${groupName}`) : reportFailure(result.error.message);
    } catch (error) {
      if (error instanceof Error) {
        return reportFailure("创建补丁组失败，磁盘内容未被修改。");
      }
      throw error;
    }
  };

  const recycle = async (): Promise<boolean> => {
    const api = withClient();
    if (api === null || selectedItems.length === 0) {
      return false;
    }
    try {
      const result = await api.recycleItems({
        items: selectedItems.map((item) => ({ kind: item.kind, relativePath: item.relativePath })),
      });
      return result.ok
        ? finish(`已将 ${result.value.ids.length} 个项目移入回收站`)
        : reportFailure(result.error.message);
    } catch (error) {
      if (error instanceof Error) {
        return reportFailure("回收失败，磁盘内容未被修改。");
      }
      throw error;
    }
  };

  const restore = async (id: string): Promise<boolean> => {
    const api = withClient();
    if (api === null) {
      return false;
    }
    try {
      const result = await api.restoreItem({ id });
      if (!result.ok) {
        return reportFailure(result.error.message);
      }
      await refresh();
      await refreshRecycle();
      showNotice({ tone: "success", message: `已恢复 ${result.value.relativePath}` });
      return true;
    } catch (error) {
      if (error instanceof Error) {
        return reportFailure("恢复失败，回收站内容未被修改。");
      }
      throw error;
    }
  };

  const emptyRecycle = async (): Promise<boolean> => {
    const api = withClient();
    if (api === null) {
      return false;
    }
    try {
      const result = await api.emptyRecycle({ confirmed: true });
      if (!result.ok) {
        return reportFailure(result.error.message);
      }
      await refreshRecycle();
      showNotice({ tone: "success", message: `已清空回收站（${result.value.removedCount} 项）` });
      return true;
    } catch (error) {
      if (error instanceof Error) {
        return reportFailure("清空回收站失败。");
      }
      throw error;
    }
  };

  return { createGroup, emptyRecycle, move, recycle, rename, restore, setEnabled };
}

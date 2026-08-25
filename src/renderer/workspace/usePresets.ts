import { useCallback, useEffect, useState } from "react";
import type { DnfApi } from "../../shared/ipc-contracts";
import type {
  AddItemsToPresetRequest,
  CreatePresetRequest,
  DeletePresetRequest,
  PresetInstallResult,
  PresetSummary,
  RenamePresetRequest,
} from "../../shared/preset-contracts";
import type { Notice } from "./model";

type PresetHookOptions = {
  readonly refreshWorkspace: () => Promise<boolean>;
  readonly showNotice: (notice: Notice) => void;
};

export function usePresets(
  client: DnfApi | undefined,
  { refreshWorkspace, showNotice }: PresetHookOptions,
) {
  const [presets, setPresets] = useState<readonly PresetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (client === undefined) {
      setLoading(false);
      return false;
    }
    setLoading(true);
    try {
      const result = await client.listPresets();
      if (!result.ok) {
        showNotice({ tone: "error", message: result.error.message });
        return false;
      }
      setPresets(result.value);
      return true;
    } catch {
      showNotice({ tone: "error", message: "读取预设失败。" });
      return false;
    } finally {
      setLoading(false);
    }
  }, [client, showNotice]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = async (request: CreatePresetRequest): Promise<boolean> => {
    if (client === undefined) {
      showNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
      return false;
    }
    setBusyKey("create");
    try {
      const result = await client.createPreset(request);
      if (!result.ok) {
        showNotice({ tone: "error", message: result.error.message });
        return false;
      }
      await refresh();
      return true;
    } catch {
      showNotice({ tone: "error", message: "创建预设失败。" });
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const addItems = async (request: AddItemsToPresetRequest): Promise<boolean> => {
    if (client === undefined) {
      showNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
      return false;
    }
    setBusyKey("append");
    try {
      const result = await client.addItemsToPreset(request);
      if (!result.ok) {
        showNotice({ tone: "error", message: result.error.message });
        return false;
      }
      await refresh();
      return true;
    } catch {
      showNotice({ tone: "error", message: "加入预设失败。" });
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const rename = async (request: RenamePresetRequest): Promise<boolean> => {
    if (client === undefined) {
      showNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
      return false;
    }
    setBusyKey(request.id);
    try {
      const result = await client.renamePreset(request);
      if (!result.ok) {
        showNotice({ tone: "error", message: result.error.message });
        return false;
      }
      await refresh();
      return true;
    } catch {
      showNotice({ tone: "error", message: "重命名预设失败。" });
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const remove = async (request: DeletePresetRequest): Promise<boolean> => {
    if (client === undefined) {
      showNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
      return false;
    }
    setBusyKey(request.id);
    try {
      const result = await client.deletePreset(request);
      if (!result.ok) {
        showNotice({ tone: "error", message: result.error.message });
        return false;
      }
      await refresh();
      return true;
    } catch {
      showNotice({ tone: "error", message: "删除预设失败。" });
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  const install = async (id: string): Promise<PresetInstallResult | null> => {
    if (client === undefined) {
      showNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
      return null;
    }
    setBusyKey(id);
    try {
      const result = await client.installPreset({ id });
      if (!result.ok) {
        showNotice({ tone: "error", message: result.error.message });
        return null;
      }
      await refresh();
      await refreshWorkspace();
      const missing =
        result.value.missingPaths.length === 0
          ? ""
          : `；跳过缺失：${result.value.missingPaths.join("、")}`;
      if (result.value.missingPaths.length > 0) {
        showNotice({
          tone: "warning",
          message: `已叠加安装 ${result.value.installedCount} 个补丁${missing}`,
        });
      }
      return result.value;
    } catch {
      showNotice({ tone: "error", message: "安装预设失败。" });
      return null;
    } finally {
      setBusyKey(null);
    }
  };

  const setEnabled = async (id: string, enabled: boolean): Promise<boolean> => {
    if (enabled) {
      return (await install(id)) !== null;
    }
    if (client === undefined) {
      showNotice({ tone: "error", message: "桌面接口不可用，请重新启动应用。" });
      return false;
    }
    const preset = presets.find((candidate) => candidate.id === id);
    if (preset === undefined) {
      showNotice({ tone: "error", message: "预设不存在。" });
      return false;
    }
    setBusyKey(id);
    try {
      if (preset.items.length > 0) {
        const result = await client.disableItems({ items: preset.items });
        if (!result.ok) {
          showNotice({ tone: "error", message: result.error.message });
          return false;
        }
      }
      await refresh();
      await refreshWorkspace();
      return true;
    } catch {
      showNotice({ tone: "error", message: "停用预设失败。" });
      return false;
    } finally {
      setBusyKey(null);
    }
  };

  return {
    addItems,
    busyKey,
    create,
    install,
    loading,
    presets,
    refresh,
    remove,
    rename,
    setEnabled,
  };
}

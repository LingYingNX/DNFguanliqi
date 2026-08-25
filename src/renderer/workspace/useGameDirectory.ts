import { useEffect, useState } from "react";
import type { DnfApi } from "../../shared/ipc-contracts";
import type { Notice } from "./model";

export function useGameDirectory(client: DnfApi | undefined) {
  const [gameDirectory, setGameDirectory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    let active = true;
    if (client === undefined) {
      setLoading(false);
      return () => {
        active = false;
      };
    }
    void client
      .getGameDirectory()
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setGameDirectory(result.value.gameDirectory);
          setNotice(null);
        } else setNotice({ tone: "error", message: result.error.message });
      })
      .catch(() => {
        if (active) setNotice({ tone: "error", message: "读取游戏目录设置失败。" });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client]);

  const save = async (value: string): Promise<boolean> => {
    if (client === undefined) return false;
    const nextDirectory = value.trim();
    if (nextDirectory.length === 0) {
      setNotice({ tone: "error", message: "请输入游戏目录" });
      return false;
    }
    setSaving(true);
    try {
      const result = await client.setGameDirectory({ gameDirectory: nextDirectory });
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return false;
      }
      setNotice(null);
      setGameDirectory(result.value.gameDirectory);
      return true;
    } catch {
      setNotice({ tone: "error", message: "保存游戏目录失败" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const select = async (): Promise<string | null> => {
    if (client === undefined) return null;
    setSelecting(true);
    try {
      const result = await client.selectGameDirectory();
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return null;
      }
      const next = result.value.gameDirectory;
      setNotice(null);
      setGameDirectory(next);
      return next;
    } catch {
      setNotice({ tone: "error", message: "选择游戏目录失败。" });
      return null;
    } finally {
      setSelecting(false);
    }
  };

  return { gameDirectory, loading, notice, save, select, selecting, saving };
}

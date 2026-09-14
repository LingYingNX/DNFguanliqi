import { useEffect, useState } from "react";
import type { DnfApi } from "../../shared/ipc-contracts";
import type { Notice } from "./model";

export function useGameDirectory(client: DnfApi | undefined, showNotice: (notice: Notice) => void) {
  const [gameDirectory, setGameDirectory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
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

  const select = async (): Promise<void> => {
    if (client === undefined) return;
    setSelecting(true);
    try {
      const result = await client.selectGameDirectory();
      if (!result.ok) {
        setNotice({ tone: "error", message: result.error.message });
        return;
      }
      const next = result.value.gameDirectory;
      setNotice(null);
      if (next !== null && next !== gameDirectory) {
        showNotice({ tone: "success", message: "游戏目录已设置" });
      }
      setGameDirectory(next);
    } catch {
      setNotice({ tone: "error", message: "选择游戏目录失败。" });
    } finally {
      setSelecting(false);
    }
  };

  return { gameDirectory, loading, notice, select, selecting };
}

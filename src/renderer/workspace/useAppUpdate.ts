import { useCallback, useEffect, useState } from "react";
import type { DnfApi } from "../../shared/ipc-contracts";

export type AppUpdate = {
  readonly phase:
    | "idle"
    | "available"
    | "checking"
    | "current"
    | "downloaded"
    | "downloading"
    | "failed";
  readonly latestVersion: string | null;
  readonly releaseNotes: readonly string[];
  readonly progress: number;
  readonly message: string | null;
  readonly check: () => Promise<void>;
  readonly download: () => Promise<void>;
  readonly install: () => Promise<void>;
};

export function useAppUpdate(client: DnfApi | undefined): AppUpdate {
  const [phase, setPhase] = useState<AppUpdate["phase"]>("idle");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<readonly string[]>([]);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (client === undefined) return;
    return client.update.subscribe((event) => {
      if (event.kind === "checking") {
        setPhase("checking");
        setMessage(null);
        return;
      }
      if (event.kind === "available") {
        setPhase("available");
        setLatestVersion(event.version);
        setReleaseNotes(event.releaseNotes);
        setMessage(null);
        return;
      }
      if (event.kind === "current") {
        setPhase("current");
        setLatestVersion(event.version);
        setReleaseNotes(event.releaseNotes);
        setProgress(0);
        return;
      }
      if (event.kind === "downloading") {
        setPhase("downloading");
        setProgress(event.percent);
        return;
      }
      if (event.kind === "downloaded") {
        setPhase("downloaded");
        setProgress(100);
        return;
      }
      setPhase("failed");
      setMessage(event.message);
    });
  }, [client]);

  const check = useCallback(async (): Promise<void> => {
    if (client === undefined) return;
    setPhase("checking");
    setMessage(null);
    try {
      const result = await client.update.check();
      if (!result.ok) {
        setPhase("failed");
        setMessage(result.error.message);
        return;
      }
      setLatestVersion(result.value.latestVersion);
      setReleaseNotes(result.value.releaseNotes);
      setPhase(result.value.updateAvailable ? "available" : "current");
    } catch {
      setPhase("failed");
      setMessage("检查更新失败，请检查网络后重试");
    }
  }, [client]);

  const download = useCallback(async (): Promise<void> => {
    if (client === undefined) return;
    setPhase("downloading");
    setProgress(0);
    setMessage(null);
    try {
      const result = await client.update.download();
      if (!result.ok) {
        setPhase("failed");
        setMessage(result.error.message);
      }
    } catch {
      setPhase("failed");
      setMessage("下载更新失败，请稍后重试");
    }
  }, [client]);

  const install = useCallback(async (): Promise<void> => {
    if (client === undefined) return;
    const result = await client.update.install();
    if (!result.ok) {
      setPhase("failed");
      setMessage(result.error.message);
    }
  }, [client]);

  return { phase, latestVersion, releaseNotes, progress, message, check, download, install };
}

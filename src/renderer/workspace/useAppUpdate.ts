import { useCallback, useEffect, useRef, useState } from "react";
import { APP_RELEASE_NOTES } from "../../shared/contracts";
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
  readonly noticeKind: "available" | "current" | null;
  readonly noticeSequence: number;
  readonly check: (manual?: boolean) => Promise<boolean>;
  readonly download: () => Promise<void>;
  readonly install: () => Promise<void>;
};

export function useAppUpdate(client: DnfApi | undefined): AppUpdate {
  const [phase, setPhase] = useState<AppUpdate["phase"]>("idle");
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<readonly string[]>(
    client?.appInfo.releaseNotes ?? APP_RELEASE_NOTES,
  );
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<AppUpdate["noticeKind"]>(null);
  const [noticeSequence, setNoticeSequence] = useState(0);
  const checkedClient = useRef<DnfApi | undefined>(undefined);
  const everSucceeded = useRef(false);

  useEffect(() => {
    if (client === undefined) return;
    setReleaseNotes(client.appInfo.releaseNotes ?? APP_RELEASE_NOTES);
    return client.update.subscribe((event) => {
      switch (event.kind) {
        case "checking":
          // A late "checking" event must not hide a notice that a newer result already showed.
          setPhase((current) => (current === "available" ? current : "checking"));
          setMessage(null);
          return;
        case "available":
          setPhase("available");
          setLatestVersion(event.version);
          setReleaseNotes(event.releaseNotes);
          setMessage(null);
          return;
        case "current":
          setPhase("current");
          setLatestVersion(event.version);
          if (event.releaseNotes.length > 0) setReleaseNotes(event.releaseNotes);
          setProgress(0);
          return;
        case "downloading":
          setPhase("downloading");
          setProgress(event.percent);
          return;
        case "downloaded":
          setPhase("downloaded");
          setProgress(100);
          return;
        case "failed":
          setPhase("failed");
          setMessage(event.message);
      }
    });
  }, [client]);

  const check = useCallback(
    async (manual = false): Promise<boolean> => {
      if (client === undefined) return false;
      setPhase("checking");
      setMessage(null);
      try {
        const result = await client.update.check();
        if (!result.ok) {
          setPhase("failed");
          setMessage(result.error.message);
          return false;
        }
        everSucceeded.current = true;
        setLatestVersion(result.value.latestVersion);
        if (result.value.updateAvailable || result.value.releaseNotes.length > 0) {
          setReleaseNotes(result.value.releaseNotes);
        }
        if (result.value.updateAvailable || manual) {
          setNoticeKind(result.value.updateAvailable ? "available" : "current");
          setNoticeSequence((value) => value + 1);
        }
        setPhase(result.value.updateAvailable ? "available" : "current");
        return true;
      } catch {
        setPhase("failed");
        setMessage("检查更新失败，请检查网络后重试");
        return false;
      }
    },
    [client],
  );

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

  useEffect(() => {
    if (client === undefined || checkedClient.current === client) return;
    checkedClient.current = client;
    // 启动自动检查失败（网络未就绪、GitHub 限流等）会让用户整个会话收不到更新
    // 提示，因此失败后自动重试，最多 2 次；任何一次成功（含手动）即终止。
    let attemptsLeft = 2;
    let timerId: number | undefined;
    let cancelled = false;
    const run = async (): Promise<void> => {
      if (cancelled) return;
      const succeeded = await check();
      if (succeeded || cancelled || everSucceeded.current || attemptsLeft <= 0) return;
      attemptsLeft -= 1;
      timerId = window.setTimeout(() => void run(), 30_000);
    };
    void run();
    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [check, client]);

  return {
    phase,
    latestVersion,
    releaseNotes,
    progress,
    message,
    noticeKind,
    noticeSequence,
    check,
    download,
    install,
  };
}

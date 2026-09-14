import { createRequire } from "node:module";
import { type BrowserWindow, ipcMain } from "electron";
import { APP_VERSION } from "../../shared/contracts";
import { type ApiResult, IPC_CHANNELS } from "../../shared/ipc-contracts";
import type { UpdateCheckResult, UpdateEvent } from "../../shared/update-contracts";
import { apiError } from "./api-result";

type AutoUpdater = typeof import("electron-updater")["autoUpdater"];

// electron-updater 只有 CommonJS 入口，且实例化时要读 app.getVersion()，
// 所以必须用 createRequire 且在打包环境里惰性加载。
const requireCjs = createRequire(import.meta.url);

const loadAutoUpdater = (): AutoUpdater =>
  (requireCjs("electron-updater") as typeof import("electron-updater")).autoUpdater;

const ok = <T>(value: T): ApiResult<T> => ({ ok: true, value });

export function registerUpdateIpc(window: BrowserWindow, isPackaged: boolean): void {
  const updater = isPackaged ? loadAutoUpdater() : undefined;
  const publish = (event: UpdateEvent): void => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.updateEvent, event);
    }
  };

  if (updater !== undefined) {
    updater.autoDownload = false;
    updater.on("checking-for-update", () => publish({ kind: "checking" }));
    updater.on("update-available", (info) => publish({ kind: "available", version: info.version }));
    updater.on("update-not-available", (info) =>
      publish({ kind: "current", version: info.version }),
    );
    updater.on("download-progress", (progress) =>
      publish({
        kind: "downloading",
        percent: Number.isFinite(progress.percent) ? Math.round(progress.percent) : 0,
      }),
    );
    updater.on("update-downloaded", (info) =>
      publish({ kind: "downloaded", version: info.version }),
    );
    updater.on("error", (error) =>
      publish({ kind: "failed", message: error.message.slice(0, 500) }),
    );
  }

  ipcMain.removeHandler(IPC_CHANNELS.checkUpdate);
  ipcMain.handle(IPC_CHANNELS.checkUpdate, async (): Promise<ApiResult<UpdateCheckResult>> => {
    if (updater === undefined) {
      return ok({
        currentVersion: APP_VERSION,
        latestVersion: APP_VERSION,
        updateAvailable: false,
      });
    }
    try {
      const checked = await updater.checkForUpdates();
      const latestVersion = checked?.updateInfo.version ?? APP_VERSION;
      return ok({
        currentVersion: APP_VERSION,
        latestVersion,
        updateAvailable: latestVersion !== APP_VERSION,
      });
    } catch {
      publish({ kind: "failed", message: "检查更新失败，请检查网络后重试" });
      return { ok: false, error: apiError("UPDATE_CHECK_FAILED") };
    }
  });

  ipcMain.removeHandler(IPC_CHANNELS.downloadUpdate);
  ipcMain.handle(IPC_CHANNELS.downloadUpdate, async (): Promise<ApiResult<null>> => {
    if (updater === undefined) return { ok: false, error: apiError("UPDATE_UNAVAILABLE") };
    try {
      await updater.downloadUpdate();
      return ok(null);
    } catch {
      publish({ kind: "failed", message: "下载更新失败，请稍后重试" });
      return { ok: false, error: apiError("UPDATE_DOWNLOAD_FAILED") };
    }
  });

  ipcMain.removeHandler(IPC_CHANNELS.installUpdate);
  ipcMain.handle(IPC_CHANNELS.installUpdate, async (): Promise<ApiResult<null>> => {
    if (updater === undefined) return { ok: false, error: apiError("UPDATE_UNAVAILABLE") };
    updater.quitAndInstall(true, true);
    return ok(null);
  });
}

import { win32 } from "node:path";
import { ipcMain } from "electron";
import { createAppSettingsStore, readAppSettings } from "../../core/appearance/appearance-settings";
import {
  createInstallationStateStore,
  readInstallationState,
} from "../../core/install/installation-state";
import { createCategoryOrderService } from "../../core/library/category-order-service";
import { createCategoryStyleService } from "../../core/library/category-style-service";
import { createPresetStateStore } from "../../core/presets/preset-state";
import { createPreviewStateStore, readPreviewState } from "../../core/previews/preview-state";
import {
  createRecycleManifestStore,
  readRecycleManifest,
} from "../../core/recycle/recycle-manifest";
import {
  createWallpaperStateStore,
  readWallpaperState,
} from "../../core/wallpapers/wallpaper-state";
import { IPC_CHANNELS } from "../../shared/ipc-contracts";
import type { RecoveryStateDto } from "../../shared/recovery-contracts";
import type { AppPaths } from "../app-paths";
import { apiError } from "./api-result";

const READ_CHANNELS = new Set<string>([
  IPC_CHANNELS.scan,
  IPC_CHANNELS.scanGroup,
  IPC_CHANNELS.listRecycle,
  IPC_CHANNELS.getGameDirectory,
  IPC_CHANNELS.getPreviewState,
  IPC_CHANNELS.getAppearance,
  IPC_CHANNELS.getCategoryStyles,
  IPC_CHANNELS.getRecoveryState,
  IPC_CHANNELS.openExternalUrl,
  IPC_CHANNELS.presetsList,
]);

export async function inspectRecoveryState(paths: AppPaths): Promise<RecoveryStateDto> {
  const data = paths.dataRoot;
  const checks = await Promise.all([
    readAppSettings(createAppSettingsStore(win32.join(data, "settings.json"))),
    readInstallationState(
      createInstallationStateStore(win32.join(data, "installation-state.json")),
    ),
    createCategoryOrderService(win32.join(data, "category-order.json")).getAll(),
    createCategoryStyleService(win32.join(data, "category-styles.json")).getAll(),
    readRecycleManifest(createRecycleManifestStore(win32.join(data, "recycle-bin.json"))),
    readPreviewState(createPreviewStateStore(win32.join(data, "previews.json"))),
    readWallpaperState(createWallpaperStateStore(win32.join(data, "wallpapers.json"))),
    createPresetStateStore(win32.join(data, "presets.json")).read(),
  ]);
  const files = checks.flatMap((result) =>
    result.ok || result.error.code === "STATE_MISSING" ? [] : [result.error.file],
  );
  return { readOnly: files.length > 0, files };
}

export function registerRecoveryMode(state: RecoveryStateDto): void {
  ipcMain.removeHandler(IPC_CHANNELS.getRecoveryState);
  ipcMain.handle(IPC_CHANNELS.getRecoveryState, async () => ({ ok: true, value: state }));
  if (!state.readOnly) return;
  for (const channel of Object.values(IPC_CHANNELS)) {
    if (READ_CHANNELS.has(channel)) continue;
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async () => ({
      ok: false,
      error: apiError("READ_ONLY_RECOVERY"),
    }));
  }
}

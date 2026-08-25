import { type BrowserWindow, dialog, ipcMain } from "electron";
import type { AsyncMutex } from "../../core/concurrency/async-mutex";
import {
  type AppSettings,
  resetWallpaperControls,
  type WallpaperState,
} from "../../core/state/schemas";
import type { WallpaperService } from "../../core/wallpapers/wallpaper-service";
import {
  UpdateAppearanceRequestSchema,
  WallpaperImportRequestSchema,
  WallpaperSlotRequestSchema,
} from "../../shared/appearance-contracts";
import { type ApiResult, IPC_CHANNELS } from "../../shared/ipc-contracts";
import { apiError, toApiResult } from "./api-result";
import type { GameDirectoryBinding } from "./game-directory-ipc";
import { createValidatedHandler } from "./validated-handler";

type Dependencies = {
  readonly binding: GameDirectoryBinding;
  readonly mutationMutex: AsyncMutex;
  readonly wallpaper: WallpaperService;
  readonly window: BrowserWindow;
};

type WallpaperDto = Pick<WallpaperState, "slots" | "activeSlot">;
type AppearanceResult = {
  readonly appearance: AppSettings["appearance"];
  readonly wallpaper: WallpaperDto;
};

function wallpaperDto(value: WallpaperState): WallpaperDto {
  return { slots: value.slots, activeSlot: value.activeSlot };
}

function state(
  binding: GameDirectoryBinding,
  wallpaperState: Awaited<ReturnType<WallpaperService["read"]>>,
): ApiResult<AppearanceResult> {
  const settings = binding.getSettings();
  if (!settings.ok) return { ok: false, error: apiError(settings.error.code) };
  return wallpaperState.ok
    ? {
        ok: true,
        value: {
          appearance: settings.value.appearance,
          wallpaper: wallpaperDto(wallpaperState.value),
        },
      }
    : { ok: false, error: apiError(wallpaperState.error.code) };
}

export function registerAppearanceIpc(deps: Dependencies): void {
  ipcMain.removeHandler(IPC_CHANNELS.getAppearance);
  ipcMain.handle(IPC_CHANNELS.getAppearance, async () =>
    state(deps.binding, await deps.wallpaper.read()),
  );

  ipcMain.removeHandler(IPC_CHANNELS.updateAppearance);
  const update = createValidatedHandler(
    UpdateAppearanceRequestSchema,
    async (appearance): Promise<ApiResult<{ appearance: AppSettings["appearance"] }>> =>
      deps.mutationMutex.runExclusive(async () => {
        const current = deps.binding.getSettings();
        if (!current.ok) return { ok: false, error: apiError(current.error.code) };
        const result = await deps.binding.updateSettings({ ...current.value, appearance });
        return result.ok ? { ok: true, value: { appearance } } : result;
      }),
  );
  ipcMain.handle(IPC_CHANNELS.updateAppearance, (_event, input: unknown) => update(input));

  const slotAction = (
    channel: string,
    action: (slot: 0 | 1 | 2 | 3 | 4) => Promise<ApiResult<AppearanceResult>>,
  ) => {
    ipcMain.removeHandler(channel);
    const handler = createValidatedHandler(WallpaperSlotRequestSchema, async ({ slot }) =>
      action(slot),
    );
    ipcMain.handle(channel, (_event, input: unknown) => handler(input));
  };
  slotAction(IPC_CHANNELS.activateWallpaper, async (slot) => {
    const result = await deps.mutationMutex.runExclusive(() => deps.wallpaper.activate(slot));
    return result.ok ? state(deps.binding, await deps.wallpaper.read()) : toApiResult(result);
  });
  slotAction(IPC_CHANNELS.deleteWallpaper, async (slot) => {
    const result = await deps.mutationMutex.runExclusive(() => deps.wallpaper.delete(slot));
    return result.ok ? state(deps.binding, await deps.wallpaper.read()) : toApiResult(result);
  });

  ipcMain.removeHandler(IPC_CHANNELS.importWallpaper);
  const importWallpaper = createValidatedHandler(WallpaperImportRequestSchema, async ({ slot }) => {
    const selection = await dialog.showOpenDialog(deps.window, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }],
    });
    if (selection.canceled) return state(deps.binding, await deps.wallpaper.read());
    const sourcePath = selection.filePaths[0];
    if (sourcePath === undefined) return { ok: false, error: apiError("INVALID_INPUT") };
    const result = await deps.mutationMutex.runExclusive(async (): Promise<ApiResult<null>> => {
      const current = deps.binding.getSettings();
      if (!current.ok) return { ok: false, error: apiError(current.error.code) };
      const updated = await deps.binding.updateSettings({
        ...current.value,
        appearance: resetWallpaperControls(current.value.appearance),
      });
      if (!updated.ok) return { ok: false, error: updated.error };

      const imported = await deps.wallpaper.importAndActivate({ slot, sourcePath });
      if (imported.ok) return { ok: true, value: null };

      const restored = await deps.binding.updateSettings(current.value);
      return restored.ok
        ? { ok: false, error: apiError(imported.error.code) }
        : { ok: false, error: apiError("ROLLBACK_FAILED") };
    });
    return result.ok ? state(deps.binding, await deps.wallpaper.read()) : result;
  });
  ipcMain.handle(IPC_CHANNELS.importWallpaper, (_event, input: unknown) => importWallpaper(input));
}

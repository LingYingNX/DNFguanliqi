import { win32 } from "node:path";
import { ipcMain } from "electron";
import type { ZodType } from "zod";
import type { AsyncMutex } from "../../core/concurrency/async-mutex";
import { createPresetService } from "../../core/presets/preset-service";
import { createPresetStateStore } from "../../core/presets/preset-state";
import { type ApiResult, IPC_CHANNELS } from "../../shared/ipc-contracts";
import {
  AddItemsToPresetRequestSchema,
  CreatePresetRequestSchema,
  DeletePresetRequestSchema,
  InstallPresetRequestSchema,
  RenamePresetRequestSchema,
} from "../../shared/preset-contracts";
import type { AppPaths } from "../app-paths";
import { toApiResult } from "./api-result";
import type { GameDirectoryBinding } from "./game-directory-ipc";
import { createValidatedHandler } from "./validated-handler";

function register<T, U>(
  channel: string,
  schema: ZodType<T>,
  action: (request: T) => Promise<ApiResult<U>>,
): void {
  ipcMain.removeHandler(channel);
  const handler = createValidatedHandler(schema, action);
  ipcMain.handle(channel, (_event, input: unknown) => handler(input));
}

type PresetIpcOptions = {
  readonly getInstallService: GameDirectoryBinding["getInstallService"];
  readonly mutationMutex: AsyncMutex;
  readonly paths: AppPaths;
};

export function registerPresetIpc({
  getInstallService,
  mutationMutex,
  paths,
}: PresetIpcOptions): void {
  const service = createPresetService({
    getInstallService: () => {
      const result = getInstallService();
      return result.ok ? result : { ok: false, error: { code: result.error.code } };
    },
    libraryRoot: paths.libraryRoot,
    store: createPresetStateStore(win32.join(paths.dataRoot, "presets.json")),
  });

  ipcMain.removeHandler(IPC_CHANNELS.presetsList);
  ipcMain.handle(IPC_CHANNELS.presetsList, async () => toApiResult(await service.list()));

  register(IPC_CHANNELS.presetsCreate, CreatePresetRequestSchema, (request) =>
    mutationMutex.runExclusive(async () => toApiResult(await service.create(request))),
  );
  register(IPC_CHANNELS.presetsRename, RenamePresetRequestSchema, (request) =>
    mutationMutex.runExclusive(async () => toApiResult(await service.rename(request))),
  );
  register(IPC_CHANNELS.presetsDelete, DeletePresetRequestSchema, (request) =>
    mutationMutex.runExclusive(async () => toApiResult(await service.remove(request))),
  );
  register(IPC_CHANNELS.presetsAddItems, AddItemsToPresetRequestSchema, (request) =>
    mutationMutex.runExclusive(async () => toApiResult(await service.addItems(request))),
  );
  register(IPC_CHANNELS.presetsInstall, InstallPresetRequestSchema, (request) =>
    mutationMutex.runExclusive(async () => toApiResult(await service.install(request.id))),
  );
}

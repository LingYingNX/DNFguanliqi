import { ipcMain } from "electron";
import { createCategoryCommands } from "../../core/library/category-commands";
import {
  CreateCategoryRequestSchema,
  DeleteCategoryRequestSchema,
  IPC_CHANNELS,
  RenameCategoryRequestSchema,
} from "../../shared/ipc-contracts";
import type { AppPaths } from "../app-paths";
import { toApiResult } from "./api-result";
import { createValidatedHandler } from "./validated-handler";

export function registerCategoryCommandIpc(paths: AppPaths): void {
  const commands = createCategoryCommands(paths.libraryRoot);

  ipcMain.removeHandler(IPC_CHANNELS.createCategory);
  const create = createValidatedHandler(CreateCategoryRequestSchema, async (request) =>
    toApiResult(await commands.create(request)),
  );
  ipcMain.handle(IPC_CHANNELS.createCategory, (_event, input: unknown) => create(input));

  ipcMain.removeHandler(IPC_CHANNELS.renameCategory);
  const rename = createValidatedHandler(RenameCategoryRequestSchema, async (request) =>
    toApiResult(await commands.rename(request)),
  );
  ipcMain.handle(IPC_CHANNELS.renameCategory, (_event, input: unknown) => rename(input));

  ipcMain.removeHandler(IPC_CHANNELS.deleteCategory);
  const remove = createValidatedHandler(DeleteCategoryRequestSchema, async (request) =>
    toApiResult(await commands.remove({ relativePath: request.relativePath })),
  );
  ipcMain.handle(IPC_CHANNELS.deleteCategory, (_event, input: unknown) => remove(input));
}

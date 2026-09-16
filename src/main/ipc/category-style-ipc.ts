import { ipcMain } from "electron";
import type { CategoryStyleService } from "../../core/library/category-style-service";
import { IPC_CHANNELS, SetCategoryStyleRequestSchema } from "../../shared/ipc-contracts";
import { toApiResult } from "./api-result";
import { createValidatedHandler } from "./validated-handler";

export function registerCategoryStyleIpc(service: CategoryStyleService): void {
  ipcMain.removeHandler(IPC_CHANNELS.getCategoryStyles);
  ipcMain.handle(IPC_CHANNELS.getCategoryStyles, async () => toApiResult(await service.getAll()));

  ipcMain.removeHandler(IPC_CHANNELS.setCategoryStyle);
  const set = createValidatedHandler(
    SetCategoryStyleRequestSchema,
    async ({ relativePath, style, color, colorStyle }) =>
      toApiResult(await service.set(relativePath, style, color, colorStyle)),
  );
  ipcMain.handle(IPC_CHANNELS.setCategoryStyle, (_event, input: unknown) => set(input));
}

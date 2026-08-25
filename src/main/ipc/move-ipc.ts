import { ipcMain } from "electron";
import { createLibraryLifecycleService } from "../../core/application/library-lifecycle-service";
import type { AsyncMutex } from "../../core/concurrency/async-mutex";
import type { InstallService } from "../../core/install/install-service";
import { moveLibraryItem } from "../../core/library/move-library-item";
import { moveLibraryItems } from "../../core/library/move-library-items";
import type { PreviewService } from "../../core/previews/preview-service";
import type { RecycleService } from "../../core/recycle/recycle-service";
import {
  type ApiResult,
  IPC_CHANNELS,
  MoveItemRequestSchema,
  MoveItemsRequestSchema,
} from "../../shared/ipc-contracts";
import type { AppPaths } from "../app-paths";
import { toApiResult } from "./api-result";
import { createValidatedHandler } from "./validated-handler";

type MoveIpcDependencies = {
  readonly getInstallService: () => ApiResult<InstallService>;
  readonly paths: AppPaths;
  readonly previews: PreviewService;
  readonly recycle: RecycleService;
  readonly mutationMutex: AsyncMutex;
};

export function registerMoveIpc({
  getInstallService,
  mutationMutex,
  paths,
  previews,
  recycle,
}: MoveIpcDependencies): void {
  ipcMain.removeHandler(IPC_CHANNELS.moveItem);
  const moveItem = createValidatedHandler(MoveItemRequestSchema, (request) =>
    mutationMutex.runExclusive(async () => {
      if (request.kind === "group") {
        return toApiResult(await moveLibraryItem({ ...request, libraryRoot: paths.libraryRoot }));
      }
      const install = getInstallService();
      if (install.ok) {
        const lifecycle = createLibraryLifecycleService({
          libraryRoot: paths.libraryRoot,
          install: install.value,
          previews,
          recycle,
        });
        return toApiResult(await lifecycle.move(request));
      }
      if (install.error.code !== "GAME_DIRECTORY_REQUIRED") return install;
      return toApiResult(await moveLibraryItem({ ...request, libraryRoot: paths.libraryRoot }));
    }),
  );
  ipcMain.handle(IPC_CHANNELS.moveItem, (_event, input: unknown) => moveItem(input));

  ipcMain.removeHandler(IPC_CHANNELS.moveItems);
  const moveItems = createValidatedHandler(MoveItemsRequestSchema, (request) =>
    mutationMutex.runExclusive(async () => {
      const patchItems: Array<{ readonly kind: "patch"; readonly sourceRelativePath: string }> = [];
      for (const item of request.items) {
        if (item.kind === "group") {
          return toApiResult(
            await moveLibraryItems({ ...request, libraryRoot: paths.libraryRoot }),
          );
        }
        patchItems.push(item);
      }
      const install = getInstallService();
      if (!install.ok) {
        if (install.error.code !== "GAME_DIRECTORY_REQUIRED") return install;
        return toApiResult(await moveLibraryItems({ ...request, libraryRoot: paths.libraryRoot }));
      }
      const lifecycle = createLibraryLifecycleService({
        libraryRoot: paths.libraryRoot,
        install: install.value,
        previews,
        recycle,
      });
      return toApiResult(await lifecycle.moveMany({ ...request, items: patchItems }));
    }),
  );
  ipcMain.handle(IPC_CHANNELS.moveItems, (_event, input: unknown) => moveItems(input));
}

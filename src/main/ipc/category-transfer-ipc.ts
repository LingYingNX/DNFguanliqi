import { win32 } from "node:path";
import { ipcMain } from "electron";
import { createCategoryCommands } from "../../core/library/category-commands";
import type { CategoryOrderService } from "../../core/library/category-order-service";
import { importPatches } from "../../core/library/import-patches";
import {
  CategoryOrderRequestSchema,
  ImportDroppedPatchesRequestSchema,
  IPC_CHANNELS,
  MoveCategoryRequestSchema,
} from "../../shared/ipc-contracts";
import type { AppPaths } from "../app-paths";
import { toApiResult } from "./api-result";
import { createValidatedHandler } from "./validated-handler";

type CategoryTransferDependencies = {
  readonly categoryOrder: CategoryOrderService;
  readonly paths: AppPaths;
};

export function registerCategoryTransferIpc({
  categoryOrder,
  paths,
}: CategoryTransferDependencies): void {
  const categories = createCategoryCommands(paths.libraryRoot);

  ipcMain.removeHandler(IPC_CHANNELS.importDroppedPatches);
  const importDropped = createValidatedHandler(
    ImportDroppedPatchesRequestSchema,
    async (request) => {
      const result = await importPatches({
        libraryRoot: paths.libraryRoot,
        categoryRelativePath: request.categoryRelativePath,
        sourcePaths: request.sourcePaths,
      });
      return result.ok
        ? {
            ok: true,
            value: {
              importedCount: result.value.importedRelativePaths.length,
              duplicateCount: result.value.duplicateRelativePaths.length,
            },
          }
        : toApiResult(result);
    },
  );
  ipcMain.handle(IPC_CHANNELS.importDroppedPatches, (_event, input: unknown) =>
    importDropped(input),
  );

  ipcMain.removeHandler(IPC_CHANNELS.setCategoryOrder);
  const setOrder = createValidatedHandler(CategoryOrderRequestSchema, async (request) => {
    const result = await categoryOrder.set(
      request.parentRelativePath,
      request.orderedChildRelativePaths,
    );
    return result.ok
      ? { ok: true, value: { orderedCount: request.orderedChildRelativePaths.length } }
      : toApiResult(result);
  });
  ipcMain.handle(IPC_CHANNELS.setCategoryOrder, (_event, input: unknown) => setOrder(input));

  ipcMain.removeHandler(IPC_CHANNELS.moveCategory);
  const moveCategory = createValidatedHandler(MoveCategoryRequestSchema, async (request) => {
    const sourceRelativePath = request.sourceRelativePath.replaceAll("/", "\\");
    const sourceParentRelativePath = win32.dirname(sourceRelativePath);
    const normalizedSourceParent = sourceParentRelativePath === "." ? "" : sourceParentRelativePath;
    const targetRelativePath = win32.join(
      request.targetParentRelativePath,
      win32.basename(sourceRelativePath),
    );
    const targetAtIndex = request.targetParentChildRelativePaths[request.targetIndex];
    if (
      normalizedSourceParent.toLocaleLowerCase() !==
        request.sourceParentRelativePath.replaceAll("/", "\\").toLocaleLowerCase() ||
      request.sourceParentChildRelativePaths.some(
        (path) =>
          path.replaceAll("/", "\\").toLocaleLowerCase() === sourceRelativePath.toLocaleLowerCase(),
      ) ||
      targetAtIndex?.replaceAll("/", "\\").toLocaleLowerCase() !==
        targetRelativePath.toLocaleLowerCase()
    ) {
      return { ok: false, error: { code: "INVALID_INPUT", message: "请求参数无效" } };
    }

    const moved = await categories.move({
      sourceRelativePath,
      targetParentRelativePath: request.targetParentRelativePath,
    });
    if (!moved.ok) return toApiResult(moved);
    const order = await categoryOrder.move({
      sourceRelativePath,
      targetRelativePath: moved.value.relativePath,
      sourceParentRelativePath: request.sourceParentRelativePath,
      sourceParentChildRelativePaths: request.sourceParentChildRelativePaths,
      targetParentRelativePath: request.targetParentRelativePath,
      targetParentChildRelativePaths: request.targetParentChildRelativePaths,
    });
    if (!order.ok) {
      await categories.move({
        sourceRelativePath: moved.value.relativePath,
        targetParentRelativePath: request.sourceParentRelativePath,
      });
      return toApiResult(order);
    }
    return { ok: true, value: moved.value };
  });
  ipcMain.handle(IPC_CHANNELS.moveCategory, (_event, input: unknown) => moveCategory(input));
}

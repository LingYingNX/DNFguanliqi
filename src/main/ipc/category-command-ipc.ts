import { ipcMain } from "electron";
import type { z } from "zod";
import { createCategoryCommands } from "../../core/library/category-commands";
import type { CategoryOrderService } from "../../core/library/category-order-service";
import type { CategoryStyleService } from "../../core/library/category-style-service";
import { scanCategory } from "../../core/library/scanner";
import { parentRelativePath } from "../../core/paths/relative-path";
import {
  type ApiResult,
  CreateCategoryRequestSchema,
  DeleteCategoryRequestSchema,
  IPC_CHANNELS,
  RenameCategoryRequestSchema,
} from "../../shared/ipc-contracts";
import type { AppPaths } from "../app-paths";
import { toApiResult } from "./api-result";
import { createValidatedHandler } from "./validated-handler";

type CategoryCommandIpcOptions = {
  readonly deleteCategory?: (
    request: z.infer<typeof DeleteCategoryRequestSchema>,
  ) => Promise<ApiResult<{ readonly relativePath: string }>>;
  readonly paths: AppPaths;
  readonly categoryOrder?: CategoryOrderService;
  readonly categoryStyle?: CategoryStyleService;
};

export function registerCategoryCommandIpc({
  deleteCategory,
  paths,
  categoryOrder,
  categoryStyle,
}: CategoryCommandIpcOptions): void {
  const commands = createCategoryCommands(paths.libraryRoot);

  // 分类顺序默认按名称排序；改名或新增后名称变了，位置就会跟着变。因此在改动之前，
  // 先把同级目录按当前显示顺序固化成显式记录，改动后顺序才锁得住。
  // 扫描器是排序规则的唯一来源，这里复用它取"当前顺序"，避免另写一套排序。
  //
  // 注意不能只判断"记录是否为空"：旧记录可能已陈旧不完整（含已删除目录、缺新建目录），
  // 那种情况下未记录的分类仍会按名称排序。判据是"当前同级目录是否都已在记录中"。
  const pinCurrentSiblingOrder = async (parentRelativePath: string): Promise<void> => {
    if (categoryOrder === undefined) return;
    const allOrders = await categoryOrder.getAll();
    if (!allOrders.ok) return;
    // 必须传入既有顺序：否则扫描器会用空顺序按名称排序，把错误顺序固化下来。
    const scanned = await scanCategory(paths.libraryRoot, parentRelativePath, {
      savedOrders: allOrders.value,
    });
    if (!scanned.ok) return;
    const siblings = scanned.value.childCategories.map((category) => category.relativePath);
    if (siblings.length === 0) return;
    const current = await categoryOrder.get(parentRelativePath);
    if (current.ok && siblings.every((path) => current.value.includes(path))) return;
    await categoryOrder.set(parentRelativePath, siblings);
  };

  ipcMain.removeHandler(IPC_CHANNELS.createCategory);
  const create = createValidatedHandler(CreateCategoryRequestSchema, async (request) => {
    // 先固化既有同级顺序，新目录才会追加在末尾，而不是按名称插进中间。
    await pinCurrentSiblingOrder(request.parentRelativePath);
    const result = await commands.create(request);
    if (!result.ok) return toApiResult(result);
    if (categoryOrder !== undefined) {
      const current = await categoryOrder.get(request.parentRelativePath);
      if (current.ok && !current.value.includes(result.value.relativePath)) {
        const orderResult = await categoryOrder.set(request.parentRelativePath, [
          ...current.value,
          result.value.relativePath,
        ]);
        if (!orderResult.ok) return toApiResult(orderResult);
      }
    }
    return toApiResult(result);
  });
  ipcMain.handle(IPC_CHANNELS.createCategory, (_event, input: unknown) => create(input));

  ipcMain.removeHandler(IPC_CHANNELS.renameCategory);
  const rename = createValidatedHandler(RenameCategoryRequestSchema, async (request) => {
    await pinCurrentSiblingOrder(parentRelativePath(request.relativePath));
    const result = await commands.rename(request);
    if (!result.ok) return toApiResult(result);
    // 顺序与样式都以相对路径为键，改名后必须同步迁移，否则该分类会退回按名称排序。
    if (categoryOrder !== undefined) {
      const orderResult = await categoryOrder.relocate(
        request.relativePath,
        result.value.relativePath,
      );
      if (!orderResult.ok) return toApiResult(orderResult);
    }
    if (categoryStyle !== undefined) {
      const styleResult = await categoryStyle.relocate(
        request.relativePath,
        result.value.relativePath,
      );
      if (!styleResult.ok) return toApiResult(styleResult);
    }
    return toApiResult(result);
  });
  ipcMain.handle(IPC_CHANNELS.renameCategory, (_event, input: unknown) => rename(input));

  ipcMain.removeHandler(IPC_CHANNELS.deleteCategory);
  const remove = createValidatedHandler(
    DeleteCategoryRequestSchema,
    deleteCategory ??
      (async (request) => {
        const result = await commands.remove(request);
        if (result.ok && categoryStyle !== undefined) {
          const styleResult = await categoryStyle.remove(request.relativePath);
          if (!styleResult.ok) return toApiResult(styleResult);
        }
        return toApiResult(result);
      }),
  );
  ipcMain.handle(IPC_CHANNELS.deleteCategory, (_event, input: unknown) => remove(input));
}

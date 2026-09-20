import { ok, type Result } from "../../shared/result";
import { normalizeRelativePath } from "../paths/relative-path";
import {
  createAtomicJsonStore,
  readOrFallback,
  type StateStoreError,
} from "../state/atomic-json-store";
import { type CategoryOrderState, CategoryOrderStateSchema } from "../state/schemas";

export type CategoryOrderService = {
  readonly getAll: () => Promise<Result<CategoryOrderState["orders"], StateStoreError>>;
  readonly get: (parentRelativePath: string) => Promise<Result<readonly string[], StateStoreError>>;
  readonly set: (
    parentRelativePath: string,
    orderedChildRelativePaths: readonly string[],
  ) => Promise<Result<void, StateStoreError>>;
  readonly move: (request: CategoryOrderMove) => Promise<Result<void, StateStoreError>>;
  readonly relocate: (
    sourceRelativePath: string,
    targetRelativePath: string,
  ) => Promise<Result<void, StateStoreError>>;
};

export type CategoryOrderMove = {
  readonly sourceRelativePath: string;
  readonly targetRelativePath: string;
  readonly sourceParentRelativePath: string;
  readonly sourceParentChildRelativePaths: readonly string[];
  readonly targetParentRelativePath: string;
  readonly targetParentChildRelativePaths: readonly string[];
};

function relocateRelativePath(
  relativePath: string,
  sourceRelativePath: string,
  targetRelativePath: string,
): string {
  const normalizedPath = normalizeRelativePath(relativePath);
  const normalizedSource = normalizeRelativePath(sourceRelativePath);
  if (normalizedPath.toLocaleLowerCase() === normalizedSource.toLocaleLowerCase()) {
    return targetRelativePath;
  }
  const prefix = `${normalizedSource}\\`;
  return normalizedPath.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())
    ? `${targetRelativePath}${normalizedPath.slice(normalizedSource.length)}`
    : normalizedPath;
}

export function createCategoryOrderService(file: string): CategoryOrderService {
  const store = createAtomicJsonStore(file, CategoryOrderStateSchema);

  const read = (): Promise<Result<CategoryOrderState, StateStoreError>> =>
    readOrFallback(store, () => ({ formatVersion: 1, orders: {} }));

  return {
    async getAll() {
      const result = await read();
      return result.ok ? ok(result.value.orders) : result;
    },
    async get(parentRelativePath) {
      const result = await read();
      return result.ok ? ok(result.value.orders[parentRelativePath] ?? []) : result;
    },
    async set(parentRelativePath, orderedChildRelativePaths) {
      const result = await read();
      if (!result.ok) {
        return result;
      }
      return store.write({
        formatVersion: 1,
        orders: { ...result.value.orders, [parentRelativePath]: [...orderedChildRelativePaths] },
      });
    },
    async move(request) {
      const result = await read();
      if (!result.ok) return result;

      const sourceParentRelativePath = normalizeRelativePath(request.sourceParentRelativePath);
      const targetParentRelativePath = normalizeRelativePath(request.targetParentRelativePath);
      const sourceRelativePath = normalizeRelativePath(request.sourceRelativePath);
      const targetRelativePath = normalizeRelativePath(request.targetRelativePath);
      const orders: Record<string, string[]> = {};
      for (const [parentRelativePath, childRelativePaths] of Object.entries(result.value.orders)) {
        const normalizedParent = normalizeRelativePath(parentRelativePath);
        if (
          normalizedParent.toLocaleLowerCase() === sourceParentRelativePath.toLocaleLowerCase() ||
          normalizedParent.toLocaleLowerCase() === targetParentRelativePath.toLocaleLowerCase()
        ) {
          continue;
        }
        const nextParent = relocateRelativePath(
          normalizedParent,
          sourceRelativePath,
          targetRelativePath,
        );
        orders[nextParent] = childRelativePaths.map((childRelativePath) =>
          relocateRelativePath(childRelativePath, sourceRelativePath, targetRelativePath),
        );
      }
      orders[sourceParentRelativePath] =
        request.sourceParentChildRelativePaths.map(normalizeRelativePath);
      orders[targetParentRelativePath] =
        request.targetParentChildRelativePaths.map(normalizeRelativePath);
      return store.write({ formatVersion: 1, orders });
    },
    async relocate(sourceRelativePath, targetRelativePath) {
      const result = await read();
      if (!result.ok) return result;

      const source = normalizeRelativePath(sourceRelativePath);
      const target = normalizeRelativePath(targetRelativePath);
      const orders: Record<string, string[]> = {};
      for (const [parentRelativePath, childRelativePaths] of Object.entries(result.value.orders)) {
        // 被重命名分类自身作为父级的顺序表：整表搬到新路径下。
        const nextParent = relocateRelativePath(parentRelativePath, source, target);
        orders[nextParent] = childRelativePaths.map((childRelativePath) =>
          relocateRelativePath(childRelativePath, source, target),
        );
      }
      return store.write({ formatVersion: 1, orders });
    },
  };
}

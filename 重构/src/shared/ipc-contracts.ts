import { z } from "zod";
import type { AppearanceApi } from "./appearance-contracts";
import { isCategoryOrderForParent } from "./category-order";
import { type CategorySnapshot, CategorySnapshotSchema } from "./library-dto";
import type { ActivePreviewDto } from "./preview-contracts";
import type { RecoveryStateDto } from "./recovery-contracts";

function isSafeRelativePath(value: string): boolean {
  if (/^[a-z]:[\\/]/iu.test(value) || value.startsWith("\\") || value.startsWith("/")) {
    return false;
  }
  return !value.replaceAll("\\", "/").split("/").includes("..");
}
export const RelativePathSchema = z.string().max(1024).refine(isSafeRelativePath);
export const ItemRelativePathSchema = RelativePathSchema.refine((value) => value.length > 0);
export const ItemKindSchema = z.union([z.literal("patch"), z.literal("group")]);
export const ScanRequestSchema = z.object({
  includeDescendants: z.boolean().default(false),
  relativePath: RelativePathSchema,
});
export const CreateGroupRequestSchema = z.object({
  categoryRelativePath: RelativePathSchema,
  patchRelativePaths: z.array(ItemRelativePathSchema).min(2),
  groupName: z.string().trim().min(1).max(120),
});
export const CreateCategoryRequestSchema = z.object({
  parentRelativePath: RelativePathSchema,
  name: z.string().trim().min(1).max(120),
});
export const RenameCategoryRequestSchema = z.object({
  relativePath: ItemRelativePathSchema,
  name: z.string().trim().min(1).max(120),
});
export const DeleteCategoryRequestSchema = z.object({
  relativePath: ItemRelativePathSchema,
  confirmed: z.literal(true),
});

export const MoveItemRequestSchema = z.object({
  kind: ItemKindSchema,
  sourceRelativePath: ItemRelativePathSchema,
  targetDirectoryRelativePath: RelativePathSchema,
  newName: z.string().trim().min(1).max(120).optional(),
});

export const MoveItemsRequestSchema = z.object({
  items: z
    .array(
      z.object({
        kind: ItemKindSchema,
        sourceRelativePath: ItemRelativePathSchema,
      }),
    )
    .min(1)
    .refine(
      (items) =>
        new Set(
          items.map((item) => item.sourceRelativePath.replaceAll("/", "\\").toLocaleLowerCase()),
        ).size === items.length,
    ),
  targetDirectoryRelativePath: RelativePathSchema,
});

export const RecycleRequestSchema = z.object({
  kind: ItemKindSchema,
  relativePath: ItemRelativePathSchema,
});

export const RestoreRequestSchema = z.object({
  id: z.string().uuid(),
});

export const InstallRequestSchema = RecycleRequestSchema;
export const InstallBatchRequestSchema = z.object({
  items: z
    .array(InstallRequestSchema)
    .min(1)
    .refine(
      (items) =>
        new Set(items.map((item) => item.relativePath.replaceAll("/", "\\").toLocaleLowerCase()))
          .size === items.length,
    ),
});
export const RecycleBatchRequestSchema = InstallBatchRequestSchema;

export const ImportDialogRequestSchema = z.object({
  categoryRelativePath: RelativePathSchema,
});
const AbsoluteNpkPathSchema = z
  .string()
  .refine((value) => /^[a-z]:[\\/]/iu.test(value) && value.toLocaleLowerCase().endsWith(".npk"));

export const ImportDroppedPatchesRequestSchema = z.object({
  categoryRelativePath: RelativePathSchema,
  sourcePaths: z.array(AbsoluteNpkPathSchema).min(1),
});

export const CategoryOrderRequestSchema = z
  .object({
    parentRelativePath: RelativePathSchema,
    orderedChildRelativePaths: z.array(ItemRelativePathSchema),
  })
  .refine(({ parentRelativePath, orderedChildRelativePaths }) =>
    isCategoryOrderForParent(parentRelativePath, orderedChildRelativePaths),
  );

export const EmptyRecycleRequestSchema = z.object({
  confirmed: z.boolean(),
});

export const RecycleEntryDtoSchema = z.object({
  id: z.string().uuid(),
  kind: ItemKindSchema,
  originalRelativePath: ItemRelativePathSchema,
  recycledRelativePath: ItemRelativePathSchema,
  recycledAt: z.string().datetime(),
});
export type RecycleEntryDto = z.infer<typeof RecycleEntryDtoSchema>;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  files: z.array(z.string()).optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export type ApiResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApiError };

export function apiResultSchema<T>(valueSchema: z.ZodType<T>): z.ZodType<ApiResult<T>> {
  return z.union([
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), error: ApiErrorSchema }),
  ]);
}

export const ScanResultSchema = apiResultSchema(CategorySnapshotSchema);

export const INVALID_INPUT_ERROR: ApiError = {
  code: "INVALID_INPUT",
  message: "请求参数无效",
};

export const IPC_CHANNELS = {
  scan: "library:scan",
  importPatches: "library:import-patches",
  importDroppedPatches: "library:import-dropped-patches",
  setCategoryOrder: "library:set-category-order",
  createGroup: "library:create-group",
  createCategory: "library:create-category",
  renameCategory: "library:rename-category",
  deleteCategory: "library:delete-category",
  moveItem: "library:move-item",
  moveItems: "library:move-items",
  recycleItem: "library:recycle-item",
  recycleItems: "library:recycle-items",
  restoreItem: "library:restore-item",
  emptyRecycle: "library:empty-recycle",
  listRecycle: "library:list-recycle",
  enableItem: "installation:enable-item",
  disableItem: "installation:disable-item",
  enableItems: "installation:enable-items",
  disableItems: "installation:disable-items",
  getGameDirectory: "installation:get-game-directory",
  selectGameDirectory: "installation:select-game-directory",
  getPreviewState: "appearance:get-preview-state",
  selectItemPreview: "appearance:select-item-preview",
  getAppearance: "appearance:get-settings",
  updateAppearance: "appearance:update-settings",
  importWallpaper: "appearance:import-wallpaper",
  activateWallpaper: "appearance:activate-wallpaper",
  deleteWallpaper: "appearance:delete-wallpaper",
  getRecoveryState: "settings:get-recovery-state",
} as const;

export type DnfApi = {
  readonly appInfo: {
    readonly name: string;
    readonly version: string;
  };
  readonly scan: (
    request: z.input<typeof ScanRequestSchema>,
  ) => Promise<ApiResult<CategorySnapshot>>;
  readonly importPatches: (
    request: z.input<typeof ImportDialogRequestSchema>,
  ) => Promise<ApiResult<{ readonly importedCount: number; readonly duplicateCount: number }>>;
  readonly importDroppedPatches: (request: {
    readonly categoryRelativePath: string;
    readonly files: readonly File[];
  }) => Promise<ApiResult<{ readonly importedCount: number; readonly duplicateCount: number }>>;
  readonly setCategoryOrder: (
    request: z.input<typeof CategoryOrderRequestSchema>,
  ) => Promise<ApiResult<{ readonly orderedCount: number }>>;
  readonly createGroup: (
    request: z.input<typeof CreateGroupRequestSchema>,
  ) => Promise<ApiResult<{ readonly id: string; readonly relativePath: string }>>;
  readonly createCategory: (
    request: z.input<typeof CreateCategoryRequestSchema>,
  ) => Promise<ApiResult<{ readonly relativePath: string }>>;
  readonly renameCategory: (
    request: z.input<typeof RenameCategoryRequestSchema>,
  ) => Promise<ApiResult<{ readonly relativePath: string }>>;
  readonly deleteCategory: (
    request: z.input<typeof DeleteCategoryRequestSchema>,
  ) => Promise<ApiResult<{ readonly relativePath: string }>>;
  readonly moveItem: (
    request: z.input<typeof MoveItemRequestSchema>,
  ) => Promise<ApiResult<{ readonly relativePath: string }>>;
  readonly moveItems: (
    request: z.input<typeof MoveItemsRequestSchema>,
  ) => Promise<ApiResult<{ readonly relativePaths: readonly string[] }>>;
  readonly recycleItem: (
    request: z.input<typeof RecycleRequestSchema>,
  ) => Promise<ApiResult<{ readonly id: string }>>;
  readonly recycleItems: (
    request: z.input<typeof RecycleBatchRequestSchema>,
  ) => Promise<ApiResult<{ readonly ids: readonly string[] }>>;
  readonly restoreItem: (
    request: z.input<typeof RestoreRequestSchema>,
  ) => Promise<ApiResult<{ readonly relativePath: string }>>;
  readonly emptyRecycle: (
    request: z.input<typeof EmptyRecycleRequestSchema>,
  ) => Promise<ApiResult<{ readonly removedCount: number }>>;
  readonly listRecycle: () => Promise<ApiResult<{ readonly items: readonly RecycleEntryDto[] }>>;
  readonly enableItem: (
    request: z.input<typeof InstallRequestSchema>,
  ) => Promise<ApiResult<{ readonly installedCount: number }>>;
  readonly disableItem: (
    request: z.input<typeof InstallRequestSchema>,
  ) => Promise<ApiResult<{ readonly removedCount: number }>>;
  readonly enableItems: (
    request: z.input<typeof InstallBatchRequestSchema>,
  ) => Promise<ApiResult<{ readonly installedCount: number }>>;
  readonly disableItems: (
    request: z.input<typeof InstallBatchRequestSchema>,
  ) => Promise<ApiResult<{ readonly removedCount: number }>>;
  readonly getGameDirectory: () => Promise<ApiResult<{ readonly gameDirectory: string | null }>>;
  readonly selectGameDirectory: () => Promise<ApiResult<{ readonly gameDirectory: string | null }>>;
  readonly getRecoveryState: () => Promise<ApiResult<RecoveryStateDto>>;
  readonly getPreviewState: () => Promise<
    ApiResult<{ readonly items: readonly ActivePreviewDto[] }>
  >;
  readonly selectItemPreview: (request: {
    readonly kind: "patch" | "group";
    readonly relativePath: string;
  }) => Promise<ApiResult<{ readonly previewUrl: string | null }>>;
} & AppearanceApi;

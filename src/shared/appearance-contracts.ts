import { z } from "zod";
import { AppearanceSettingsSchema } from "../core/state/schemas";
import type { ApiResult } from "./ipc-contracts";

export const AppearanceSettingsDtoSchema = AppearanceSettingsSchema;
export type AppearanceSettingsDto = z.infer<typeof AppearanceSettingsDtoSchema>;

export const UpdateAppearanceRequestSchema = AppearanceSettingsDtoSchema;

export const WallpaperSlotSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
export type WallpaperSlot = z.infer<typeof WallpaperSlotSchema>;

export const WallpaperStateDtoSchema = z.object({
  slots: z.tuple([
    z.string().min(1).nullable(),
    z.string().min(1).nullable(),
    z.string().min(1).nullable(),
    z.string().min(1).nullable(),
    z.string().min(1).nullable(),
  ]),
  activeSlot: WallpaperSlotSchema.nullable(),
});
export type WallpaperStateDto = z.infer<typeof WallpaperStateDtoSchema>;
export const AppearanceBundleDtoSchema = z.object({
  appearance: AppearanceSettingsDtoSchema,
  wallpaper: WallpaperStateDtoSchema,
});
export type AppearanceBundleDto = z.infer<typeof AppearanceBundleDtoSchema>;

export type WallpaperSlotRequest = { readonly slot: WallpaperSlot };
export type AppearanceApi = {
  readonly getAppearance: () => Promise<ApiResult<AppearanceBundleDto>>;
  readonly updateAppearance: (
    request: AppearanceSettingsDto,
  ) => Promise<ApiResult<{ readonly appearance: AppearanceSettingsDto }>>;
  readonly importWallpaper: (
    request: WallpaperSlotRequest,
  ) => Promise<ApiResult<AppearanceBundleDto>>;
  readonly activateWallpaper: (
    request: WallpaperSlotRequest,
  ) => Promise<ApiResult<AppearanceBundleDto>>;
  readonly deleteWallpaper: (
    request: WallpaperSlotRequest,
  ) => Promise<ApiResult<AppearanceBundleDto>>;
};

export const WallpaperImportRequestSchema = z.object({ slot: WallpaperSlotSchema });
export const WallpaperSlotRequestSchema = z.object({ slot: WallpaperSlotSchema });

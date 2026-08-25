import { z } from "zod";

function isSafeRelativePath(value: string): boolean {
  if (/^[a-z]:[\\/]/iu.test(value) || value.startsWith("\\") || value.startsWith("/")) {
    return false;
  }
  return !value.replaceAll("\\", "/").split("/").includes("..");
}

export const PresetRelativePathSchema = z.string().min(1).max(1024).refine(isSafeRelativePath);

export const PresetItemReferenceSchema = z.object({
  kind: z.literal("patch"),
  relativePath: PresetRelativePathSchema,
});

export const PresetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  items: z.array(PresetItemReferenceSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PresetItemReference = z.infer<typeof PresetItemReferenceSchema>;
export type PresetDto = z.infer<typeof PresetSchema>;

export const PresetSummarySchema = PresetSchema.extend({
  missingPaths: z.array(PresetRelativePathSchema),
});
export type PresetSummary = z.infer<typeof PresetSummarySchema>;

export const CreatePresetRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  items: z.array(PresetItemReferenceSchema).min(1),
});
export type CreatePresetRequest = z.infer<typeof CreatePresetRequestSchema>;

export const RenamePresetRequestSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});
export type RenamePresetRequest = z.infer<typeof RenamePresetRequestSchema>;

export const DeletePresetRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DeletePresetRequest = z.infer<typeof DeletePresetRequestSchema>;

export const AddItemsToPresetRequestSchema = z.object({
  id: z.string().uuid(),
  items: z.array(PresetItemReferenceSchema).min(1),
});
export type AddItemsToPresetRequest = z.infer<typeof AddItemsToPresetRequestSchema>;

export const InstallPresetRequestSchema = z.object({
  id: z.string().uuid(),
});
export type InstallPresetRequest = z.infer<typeof InstallPresetRequestSchema>;

export const PresetInstallResultSchema = z.object({
  installedCount: z.number().int().nonnegative(),
  missingPaths: z.array(PresetRelativePathSchema),
});
export type PresetInstallResult = z.infer<typeof PresetInstallResultSchema>;

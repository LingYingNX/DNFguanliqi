import { z } from "zod";

function isSafeItemPath(value: string): boolean {
  if (value.length === 0 || /^[a-z]:[\\/]/iu.test(value) || /^[\\/]/u.test(value)) return false;
  return !value.replaceAll("\\", "/").split("/").includes("..");
}

export const PreviewItemKindSchema = z.union([z.literal("patch"), z.literal("group")]);

export const SelectItemPreviewRequestSchema = z.object({
  kind: PreviewItemKindSchema,
  relativePath: z.string().max(1024).refine(isSafeItemPath),
});

export const ActivePreviewDtoSchema = z.object({
  kind: PreviewItemKindSchema,
  relativePath: z.string(),
  previewUrl: z.string(),
});

export type ActivePreviewDto = z.infer<typeof ActivePreviewDtoSchema>;

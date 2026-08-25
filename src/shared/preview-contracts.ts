import { z } from "zod";

function isSafeItemPath(value: string): boolean {
  if (value.length === 0 || /^[a-z]:[\\/]/iu.test(value) || /^[\\/]/u.test(value)) return false;
  return !value.replaceAll("\\", "/").split("/").includes("..");
}

export const PreviewItemKindSchema = z.union([z.literal("patch"), z.literal("group")]);

export const SelectItemPreviewRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("patch"),
    relativePath: z.string().max(1024).refine(isSafeItemPath),
  }),
  z.object({
    kind: z.literal("group"),
    groupId: z.string().uuid(),
  }),
]);

export const ActivePreviewDtoSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("patch"),
    relativePath: z.string(),
    previewUrl: z.string(),
  }),
  z.object({
    kind: z.literal("group"),
    groupId: z.string().uuid(),
    previewUrl: z.string(),
  }),
]);

export type ActivePreviewDto = z.infer<typeof ActivePreviewDtoSchema>;

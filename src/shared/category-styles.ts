import { z } from "zod";

export const CategoryFolderStyleSchema = z.enum(["blue-outline", "star", "outline", "add"]);

export type CategoryFolderStyle = z.infer<typeof CategoryFolderStyleSchema>;

export const CategoryColorSchema = z.string().regex(/^#[0-9a-f]{6}$/iu);

export const CategoryFolderStylesSchema = z.record(z.string(), CategoryFolderStyleSchema);
export const CategoryFolderColorsSchema = z.record(z.string(), CategoryColorSchema);
export const CategoryFolderStyleColorsSchema = z.partialRecord(
  CategoryFolderStyleSchema,
  CategoryColorSchema,
);

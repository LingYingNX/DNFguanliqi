import { z } from "zod";

const INVALID_NAME_CHARACTERS = new Set('<>:"/\\|?*');

function hasInvalidNameCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (INVALID_NAME_CHARACTERS.has(character) || (codePoint !== undefined && codePoint < 32)) {
      return true;
    }
  }
  return false;
}

export const LibraryItemNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => !hasInvalidNameCharacter(value))
  .refine((value) => value !== "." && value !== "..")
  .refine((value) => !/[. ]$/u.test(value));

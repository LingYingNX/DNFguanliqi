import { readFile } from "node:fs/promises";
import { win32 } from "node:path";
import { z } from "zod";

export const GroupMarkerSchema = z.object({
  formatVersion: z.literal(1),
  id: z.string().uuid(),
  displayName: z.string().trim().min(1),
  createdAt: z.string().datetime(),
});

export type GroupMarker = z.infer<typeof GroupMarkerSchema>;

export async function readGroupMarker(directory: string): Promise<GroupMarker | null> {
  try {
    const raw: unknown = JSON.parse(
      await readFile(win32.join(directory, ".dnf-group.json"), "utf8"),
    );
    const parsed = GroupMarkerSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

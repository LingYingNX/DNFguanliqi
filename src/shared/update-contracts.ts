import { z } from "zod";

export const UpdateCheckResultSchema = z.object({
  currentVersion: z.string(),
  latestVersion: z.string(),
  updateAvailable: z.boolean(),
});
export type UpdateCheckResult = z.infer<typeof UpdateCheckResultSchema>;

export const UpdateEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("checking") }),
  z.object({ kind: z.literal("available"), version: z.string() }),
  z.object({ kind: z.literal("current"), version: z.string() }),
  z.object({
    kind: z.literal("downloading"),
    percent: z.number().min(0).max(100),
  }),
  z.object({ kind: z.literal("downloaded"), version: z.string() }),
  z.object({ kind: z.literal("failed"), message: z.string().max(500) }),
]);
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;

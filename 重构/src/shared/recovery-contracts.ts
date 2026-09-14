import { z } from "zod";

export const RecoveryStateDtoSchema = z.object({
  readOnly: z.boolean(),
  files: z.array(z.string()),
});
export type RecoveryStateDto = z.infer<typeof RecoveryStateDtoSchema>;

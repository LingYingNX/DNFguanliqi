import { z } from "zod";
import { PresetSchema } from "../../shared/preset-contracts";
import { type AtomicJsonStore, createAtomicJsonStore } from "../state/atomic-json-store";

export const PresetStateSchema = z.object({
  formatVersion: z.literal(1),
  presets: z.array(PresetSchema),
});

export type PresetState = z.infer<typeof PresetStateSchema>;

export function createPresetStateStore(file: string): AtomicJsonStore<PresetState> {
  return createAtomicJsonStore(file, PresetStateSchema);
}

import type { Result } from "../../shared/result";
import {
  type AtomicJsonStore,
  createAtomicJsonStore,
  readOrFallback,
  type StateStoreError,
} from "../state/atomic-json-store";
import { emptyPreviewState, type PreviewState, PreviewStateSchema } from "../state/schemas";

export function createPreviewStateStore(file: string): AtomicJsonStore<PreviewState> {
  return createAtomicJsonStore(file, PreviewStateSchema);
}

export async function readPreviewState(
  store: AtomicJsonStore<PreviewState>,
): Promise<Result<PreviewState, StateStoreError>> {
  return readOrFallback(store, emptyPreviewState);
}

class PreviewStateWriteError extends Error {
  override readonly name = "PreviewStateWriteError";
}

export async function writePreviewState(
  store: AtomicJsonStore<PreviewState>,
  state: PreviewState,
): Promise<void> {
  const result = await store.write(state);
  if (!result.ok) throw new PreviewStateWriteError("Unable to write preview state");
}

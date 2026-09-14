import { ok, type Result } from "../../shared/result";
import {
  type AtomicJsonStore,
  createAtomicJsonStore,
  type StateStoreError,
} from "../state/atomic-json-store";
import { emptyWallpaperState, type WallpaperState, WallpaperStateSchema } from "../state/schemas";

export function createWallpaperStateStore(file: string): AtomicJsonStore<WallpaperState> {
  return createAtomicJsonStore(file, WallpaperStateSchema);
}

export async function readWallpaperState(
  store: AtomicJsonStore<WallpaperState>,
): Promise<Result<WallpaperState, StateStoreError>> {
  const result = await store.read();
  return result.ok || result.error.code !== "STATE_MISSING" ? result : ok(emptyWallpaperState());
}

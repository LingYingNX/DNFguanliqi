import { rm } from "node:fs/promises";
import { ok, type Result } from "../../shared/result";
import {
  type AtomicJsonStore,
  createAtomicJsonStore,
  type StateStoreError,
} from "../state/atomic-json-store";
import {
  emptyRecycleManifest,
  type RecycleManifest,
  RecycleManifestSchema,
} from "../state/schemas";

export type ManifestSnapshot = {
  readonly manifest: RecycleManifest;
  readonly existed: boolean;
};

class ManifestWriteError extends Error {
  override readonly name = "ManifestWriteError";
}

export function createRecycleManifestStore(file: string): AtomicJsonStore<RecycleManifest> {
  return createAtomicJsonStore(file, RecycleManifestSchema);
}

export async function readRecycleManifest(
  store: AtomicJsonStore<RecycleManifest>,
): Promise<Result<ManifestSnapshot, StateStoreError>> {
  const result = await store.read();
  if (result.ok) {
    return ok({ manifest: result.value, existed: true });
  }
  if (result.error.code === "STATE_MISSING") {
    return ok({ manifest: emptyRecycleManifest(), existed: false });
  }
  return result;
}

export async function writeRecycleManifest(
  store: AtomicJsonStore<RecycleManifest>,
  manifest: RecycleManifest,
): Promise<void> {
  const result = await store.write(manifest);
  if (!result.ok) {
    throw new ManifestWriteError("Unable to write recycle manifest");
  }
}

export async function restoreRecycleManifest(
  store: AtomicJsonStore<RecycleManifest>,
  file: string,
  snapshot: ManifestSnapshot,
): Promise<void> {
  if (snapshot.existed) {
    await writeRecycleManifest(store, snapshot.manifest);
  } else {
    await rm(file, { force: true });
  }
}

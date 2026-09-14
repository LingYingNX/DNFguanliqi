import { rm } from "node:fs/promises";
import { ok, type Result } from "../../shared/result";
import {
  type AtomicJsonStore,
  createAtomicJsonStore,
  type StateStoreError,
} from "../state/atomic-json-store";
import {
  emptyInstallationState,
  type InstallationState,
  InstallationStateSchema,
} from "../state/schemas";

export type InstallationStateSnapshot = {
  readonly state: InstallationState;
  readonly existed: boolean;
};

class InstallationStateWriteError extends Error {
  override readonly name = "InstallationStateWriteError";
}

export function createInstallationStateStore(file: string): AtomicJsonStore<InstallationState> {
  return createAtomicJsonStore(file, InstallationStateSchema);
}

export async function readInstallationState(
  store: AtomicJsonStore<InstallationState>,
): Promise<Result<InstallationStateSnapshot, StateStoreError>> {
  const result = await store.read();
  if (result.ok) {
    return ok({ state: result.value, existed: true });
  }
  if (result.error.code === "STATE_MISSING") {
    return ok({ state: emptyInstallationState(), existed: false });
  }
  return result;
}

export async function writeInstallationState(
  store: AtomicJsonStore<InstallationState>,
  state: InstallationState,
): Promise<void> {
  const result = await store.write(state);
  if (!result.ok) {
    throw new InstallationStateWriteError("Unable to write installation state");
  }
}

export async function restoreInstallationState(
  store: AtomicJsonStore<InstallationState>,
  file: string,
  snapshot: InstallationStateSnapshot,
): Promise<void> {
  if (snapshot.existed) {
    await writeInstallationState(store, snapshot.state);
  } else {
    await rm(file, { force: true });
  }
}

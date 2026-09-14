import { ok, type Result } from "../../shared/result";
import {
  type AtomicJsonStore,
  createAtomicJsonStore,
  type StateStoreError,
} from "../state/atomic-json-store";
import { type AppSettings, AppSettingsSchema, defaultAppSettings } from "../state/schemas";

export function createAppSettingsStore(file: string): AtomicJsonStore<AppSettings> {
  return createAtomicJsonStore(file, AppSettingsSchema);
}

export async function readAppSettings(
  store: AtomicJsonStore<AppSettings>,
): Promise<Result<AppSettings, StateStoreError>> {
  const result = await store.read();
  return result.ok || result.error.code !== "STATE_MISSING" ? result : ok(defaultAppSettings());
}

export function withGameDirectory(
  settings: AppSettings,
  gameDirectory: string | null,
): AppSettings {
  return { ...settings, gameDirectory };
}

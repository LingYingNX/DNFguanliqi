import { err, ok, type Result } from "../../shared/result";
import type { ManagedImageAssets, ManagedImageError } from "../assets/managed-image-assets";
import type { AtomicJsonStore, StateStoreError } from "../state/atomic-json-store";
import type { WallpaperState } from "../state/schemas";
import { readWallpaperState } from "./wallpaper-state";

type WallpaperSlot = 0 | 1 | 2 | 3 | 4;

export type WallpaperServiceError =
  | StateStoreError
  | ManagedImageError
  | { readonly code: "WALLPAPER_EMPTY" };

type WallpaperImportResult = {
  readonly slot: WallpaperSlot;
  readonly assetName: string;
  readonly wallpaperUrl: string;
};

export type WallpaperService = {
  readonly read: () => Promise<Result<WallpaperState, StateStoreError>>;
  readonly import: (request: {
    readonly slot: WallpaperSlot;
    readonly sourcePath: string;
  }) => Promise<Result<WallpaperImportResult, WallpaperServiceError>>;
  readonly importAndActivate: (request: {
    readonly slot: WallpaperSlot;
    readonly sourcePath: string;
  }) => Promise<Result<WallpaperImportResult, WallpaperServiceError>>;
  readonly activate: (
    slot: WallpaperSlot,
  ) => Promise<Result<{ readonly activeSlot: WallpaperSlot }, WallpaperServiceError>>;
  readonly delete: (
    slot: WallpaperSlot,
  ) => Promise<Result<{ readonly slot: WallpaperSlot }, WallpaperServiceError>>;
};

type WallpaperServiceOptions = {
  readonly assets: ManagedImageAssets;
  readonly store: AtomicJsonStore<WallpaperState>;
};

export function createWallpaperService(options: WallpaperServiceOptions): WallpaperService {
  const importWallpaper = async (
    request: { readonly slot: WallpaperSlot; readonly sourcePath: string },
    shouldActivate: boolean,
  ): Promise<Result<WallpaperImportResult, WallpaperServiceError>> => {
    const current = await readWallpaperState(options.store);
    if (!current.ok) return current;
    const copied = await options.assets.copyFrom(request.sourcePath);
    if (!copied.ok) return copied;
    const displaced = current.value.slots[request.slot];
    const slots = [...current.value.slots] as [
      string | null,
      string | null,
      string | null,
      string | null,
      string | null,
    ];
    slots[request.slot] = copied.value.assetName;
    const written = await options.store.write({
      ...current.value,
      slots,
      activeSlot: shouldActivate ? request.slot : current.value.activeSlot,
    });
    if (!written.ok) {
      const cleanup = await options.assets.remove(copied.value.assetName);
      return cleanup.ok ? written : cleanup;
    }
    if (displaced !== null) {
      // The new wallpaper state is already committed; old-asset cleanup is best effort.
      await options.assets.remove(displaced);
    }
    return ok({
      slot: request.slot,
      assetName: copied.value.assetName,
      wallpaperUrl: copied.value.url,
    });
  };

  return {
    read: () => readWallpaperState(options.store),
    import: (request) => importWallpaper(request, false),
    importAndActivate: (request) => importWallpaper(request, true),
    async activate(slot) {
      const current = await readWallpaperState(options.store);
      if (!current.ok) return current;
      if (current.value.slots[slot] === null) return err({ code: "WALLPAPER_EMPTY" });
      const written = await options.store.write({ ...current.value, activeSlot: slot });
      return written.ok ? ok({ activeSlot: slot }) : written;
    },
    async delete(slot) {
      const current = await readWallpaperState(options.store);
      if (!current.ok) return current;
      const assetName = current.value.slots[slot];
      if (assetName === null) return err({ code: "WALLPAPER_EMPTY" });
      const slots = [...current.value.slots] as [
        string | null,
        string | null,
        string | null,
        string | null,
        string | null,
      ];
      slots[slot] = null;
      const written = await options.store.write({
        ...current.value,
        slots,
        activeSlot: current.value.activeSlot === slot ? null : current.value.activeSlot,
      });
      if (!written.ok) return written;
      const removed = await options.assets.remove(assetName);
      return removed.ok ? ok({ slot }) : removed;
    },
  };
}

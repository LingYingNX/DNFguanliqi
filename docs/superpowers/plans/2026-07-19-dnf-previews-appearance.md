# DNF Previews and Appearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add managed item previews, five wallpaper slots, persisted appearance controls, and a real Halo settings dialog.

**Architecture:** Extend `settings.json` with appearance values while keeping preview bindings and wallpaper slots in focused atomic stores. Main-process services own native pickers and confined managed assets; typed IPC exposes only managed URLs and state DTOs. Renderer hooks apply CSS variables and drive one scrollable settings dialog.

**Tech Stack:** Electron, React, strict TypeScript, Zod, Node filesystem APIs, Vitest, Testing Library, Playwright, Halo CSS tokens.

---

### Task 1: Appearance, Preview, and Wallpaper State

**Files:**
- Modify: `src/core/state/schemas.ts`
- Create: `src/core/appearance/appearance-settings.ts`
- Create: `src/core/previews/preview-state.ts`
- Create: `src/core/wallpapers/wallpaper-state.ts`
- Test: `tests/integration/appearance-state.test.ts`

- [ ] **Step 1: Write failing state tests**

Cover exact defaults, every numeric bound, `#RRGGBB`, five nullable wallpaper slots, active empty-slot rejection, active/recycled preview bindings, missing-file defaults, and corrupted-file errors.

- [ ] **Step 2: Run the red test**

Run: `rtk pnpm vitest run tests/integration/appearance-state.test.ts`

Expected: FAIL because the schemas and stores do not exist.

- [ ] **Step 3: Implement strict schemas and stores**

Define `AppearanceSettingsSchema`, extend `AppSettingsSchema`, and add:

```ts
export type PreviewBinding =
  | { readonly state: "active"; readonly kind: "patch" | "group"; readonly relativePath: string; readonly assetName: string }
  | { readonly state: "recycled"; readonly recycleEntryId: string; readonly assetName: string };

export type WallpaperState = {
  readonly formatVersion: 1;
  readonly slots: readonly [string | null, string | null, string | null, string | null, string | null];
  readonly activeSlot: 0 | 1 | 2 | 3 | 4 | null;
};
```

Use `createAtomicJsonStore` and explicit missing-file defaults; propagate corruption.

- [ ] **Step 4: Run state tests and typecheck**

Run: `rtk pnpm vitest run tests/integration/appearance-state.test.ts && rtk pnpm typecheck`

Expected: PASS.

### Task 2: Confined Managed Image Assets

**Files:**
- Create: `src/core/assets/managed-image-assets.ts`
- Create: `src/main/managed-asset-protocol.ts`
- Modify: `src/main/main.ts`
- Test: `tests/integration/managed-image-assets.test.ts`

- [ ] **Step 1: Write failing asset tests**

Test allowed extensions, unsupported extension rejection, exclusive generated names, source preservation, replacement cleanup ordering, and rejection of names containing separators.

- [ ] **Step 2: Run the red test**

Run: `rtk pnpm vitest run tests/integration/managed-image-assets.test.ts`

Expected: FAIL because the asset manager is absent.

- [ ] **Step 3: Implement the asset manager and protocol**

Expose only these operations:

```ts
export interface ManagedImageAssets {
  copyFrom(sourcePath: string): Promise<Result<{ readonly assetName: string }, ManagedImageError>>;
  remove(assetName: string): Promise<Result<void, ManagedImageError>>;
  url(assetName: string): string;
}
```

Use generated UUID filenames plus the validated lowercase extension and `COPYFILE_EXCL`. Register `dnf-asset://preview/<name>` and `dnf-asset://wallpaper/<name>` handlers that resolve only parsed managed names under their configured roots.

- [ ] **Step 4: Run tests and typecheck**

Run: `rtk pnpm vitest run tests/integration/managed-image-assets.test.ts && rtk pnpm typecheck`

Expected: PASS.

### Task 3: Preview Selection and Scanner Projection

**Files:**
- Create: `src/core/previews/preview-service.ts`
- Create: `src/main/ipc/preview-ipc.ts`
- Modify: `src/main/ipc/register-ipc.ts`
- Modify: `src/shared/ipc-contracts.ts`
- Modify: `src/shared/library-dto.ts`
- Modify: `src/preload/preload.ts`
- Modify: `src/core/library/scanner.ts`
- Test: `tests/integration/preview-service.test.ts`
- Test: `tests/integration/scanner.test.ts`

- [ ] **Step 1: Write failing preview and scanner tests**

Test canceled picker, managed copy, replacement, patch/group binding, corruption propagation, and scanner DTO projection to a managed URL.

- [ ] **Step 2: Run red tests**

Run: `rtk pnpm vitest run tests/integration/preview-service.test.ts tests/integration/scanner.test.ts`

Expected: FAIL on missing service/API behavior.

- [ ] **Step 3: Implement typed service and IPC**

Add `getPreviewState` and `selectItemPreview` contracts. The renderer sends only `{ kind, relativePath }`; the main process owns the image dialog and returns `{ previewUrl }`. Project preview bindings onto scanned patch and group DTOs after the filesystem scan.

- [ ] **Step 4: Run focused tests**

Run: `rtk pnpm vitest run tests/integration/preview-service.test.ts tests/integration/scanner.test.ts && rtk pnpm typecheck`

Expected: PASS.

### Task 4: Preview Lifecycle Transactions

**Files:**
- Modify: `src/core/application/library-lifecycle-service.ts`
- Modify: `src/core/previews/preview-service.ts`
- Modify: `src/main/ipc/move-ipc.ts`
- Modify: `src/main/ipc/register-ipc.ts`
- Test: `tests/integration/library-lifecycle-service.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Prove move/rename updates active paths, recycle binds by recycle entry ID, restore reactivates the restored path, and a new item at the recycled old path receives no preview.

- [ ] **Step 2: Run the red test**

Run: `rtk pnpm vitest run tests/integration/library-lifecycle-service.test.ts`

Expected: FAIL because preview binding is not part of lifecycle transactions.

- [ ] **Step 3: Add preview transaction plans**

Extend lifecycle dependencies with a focused preview service whose `prepareMoveMany`, `prepareRecycleMany`, and `prepareRestore` methods return `FileTransactionStep[]`. Compose these steps with existing library/install/recycle transactions; preserve current rollback semantics.

- [ ] **Step 4: Run lifecycle regression**

Run: `rtk pnpm vitest run tests/integration/library-lifecycle-service.test.ts tests/integration/recycle-service.test.ts tests/integration/install-relocation.test.ts`

Expected: PASS.

### Task 5: Wallpaper and Appearance IPC

**Files:**
- Create: `src/core/wallpapers/wallpaper-service.ts`
- Create: `src/main/ipc/appearance-ipc.ts`
- Modify: `src/main/ipc/game-directory-ipc.ts`
- Modify: `src/shared/ipc-contracts.ts`
- Modify: `src/preload/preload.ts`
- Test: `tests/integration/wallpaper-service.test.ts`

- [ ] **Step 1: Write failing wallpaper tests**

Cover import, replace, activate, delete, source preservation, displaced-file cleanup, invalid slot, and active empty-slot rejection.

- [ ] **Step 2: Run the red test**

Run: `rtk pnpm vitest run tests/integration/wallpaper-service.test.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement service and typed settings IPC**

Add `getAppearance`, `updateAppearance`, `importWallpaper`, `activateWallpaper`, and `deleteWallpaper`. Reuse the settings store owned by game-directory IPC so directory and appearance updates cannot overwrite each other; serialize them through the shared mutation mutex.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `rtk pnpm vitest run tests/integration/wallpaper-service.test.ts tests/renderer/game-directory.test.tsx && rtk pnpm typecheck`

Expected: PASS.

### Task 6: Halo Settings Dialog and Real Preview Rendering

**Files:**
- Create: `src/renderer/workspace/useAppearance.ts`
- Create: `src/renderer/components/SettingsDialog.tsx`
- Create: `src/renderer/styles/settings.css`
- Modify: `src/renderer/components/AppToolbar.tsx`
- Modify: `src/renderer/components/ItemWorkspace.tsx`
- Modify: `src/renderer/components/WorkspaceApp.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/styles/tokens.css`
- Test: `tests/renderer/appearance-settings.test.tsx`
- Test: `tests/renderer/item-preview.test.tsx`

- [ ] **Step 1: Write failing renderer tests**

Test toolbar Settings command, five slots, segmented theme, seven sliders, two color inputs, immediate CSS variables, and preview-region double-click for patch and group without triggering rename.

- [ ] **Step 2: Run renderer red tests**

Run: `rtk pnpm vitest run tests/renderer/appearance-settings.test.tsx tests/renderer/item-preview.test.tsx`

Expected: FAIL because the UI and callbacks are absent.

- [ ] **Step 3: Implement the renderer slice**

Use `Settings`, `ImagePlus`, `Trash2`, and `Check` Lucide icons. Keep dialog state in `useAppearance`; render managed `<img>` previews with accessible labels; apply theme and wallpaper variables to `.app-shell`. Keep `SettingsDialog.tsx` below 250 lines by extracting a numeric row helper only if needed.

- [ ] **Step 4: Run renderer regression and inspect 1280 layout**

Run: `rtk pnpm vitest run tests/renderer/appearance-settings.test.tsx tests/renderer/item-preview.test.tsx tests/renderer/workspace.test.tsx`

Expected: PASS.

### Task 7: Electron Visual Verification and Delivery

**Files:**
- Create: `tests/e2e/appearance.e2e.ts`
- Create: `.scratch/task-10-report.md`

- [ ] **Step 1: Add real Electron E2E**

Generate bitmap fixtures in a temporary directory, substitute native pickers, set a patch and group preview, populate wallpaper slots, change visible appearance values, restart, and verify persisted rendering.

- [ ] **Step 2: Capture three viewports**

Capture 1280x720, 1440x900, and 1920x1080. Assert document width/height do not overflow and inspect every screenshot for blank images, overlap, clipped text, and insufficient contrast.

- [ ] **Step 3: Run all gates**

Run: `rtk pnpm lint`

Run: `rtk pnpm vitest run --maxWorkers=2`

Run: `rtk pnpm typecheck`

Run: `rtk pnpm build`

Run: `rtk pnpm test:e2e`

Expected: every command exits 0 with no skipped tests.

- [ ] **Step 4: Record evidence and commit**

Write red/green output, screenshot paths, changed-file LOC, review verdicts, and remaining risks to `.scratch/task-10-report.md`. Stage only source/config/tests/docs and commit `feat: add previews and appearance settings`.

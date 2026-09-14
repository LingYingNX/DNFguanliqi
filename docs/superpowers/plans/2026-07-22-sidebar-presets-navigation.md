# Sidebar Navigation and Presets Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execute this plan task-by-task in the current session; do not dispatch subagents.

**Goal:** Rebuild the left navigation to match the reference layout and add durable local presets that reference existing NPK files and can be installed additively.

**Architecture:** Keep real category paths and system navigation as separate renderer state. Add a typed preset contract across shared IPC, preload, and main process. Persist preset manifests in data/presets.json through the existing atomic JSON store, and reuse InstallService.enableMany for additive installation.

**Tech Stack:** Electron 43, React 19, TypeScript 5.9, Zod 4, Vitest, Testing Library, Playwright, existing atomic JSON and install transaction services.

---

## Existing File Map

Create:

- src/shared/preset-contracts.ts: Zod schemas and DTOs for preset state, requests, and results.
- src/core/presets/preset-state.ts: atomic JSON store factory and format-versioned state schema.
- src/core/presets/preset-service.ts: path validation, CRUD, missing-reference resolution, and additive installation orchestration.
- src/main/ipc/preset-ipc.ts: validated IPC registration for preset methods.
- src/renderer/workspace/usePresets.ts: renderer state and typed API actions.
- src/renderer/components/PresetWorkspace.tsx: preset list and per-preset commands.
- src/renderer/components/PresetDialogs.tsx: create, rename, and append forms.
- tests/integration/preset-service.test.ts: real temporary-directory preset and install tests.
- tests/renderer/preset-workspace.test.tsx: navigation, creation, missing references, and install UI tests.
- tests/e2e/presets.e2e.ts: real Electron persistence and additive installation flow.

Modify:

- src/shared/ipc-contracts.ts: channels, request/result schemas, and DnfApi methods.
- src/preload/preload.ts: parse and expose preset methods.
- src/main/ipc/register-ipc.ts: initialize and register preset IPC with the existing mutex and recovery state.
- src/renderer/workspace/model.ts: NavigationSelection and preset view item types.
- src/renderer/workspace/useWorkspace.ts: root/all/unclassified scopes without changing category operations.
- src/renderer/workspace/useWorkspaceOperations.ts: create-preset callback request from selected patch items.
- src/renderer/components/WorkspaceApp.tsx: navigation state, preset hook, dialogs, and placeholder routing.
- src/renderer/components/CategorySidebar.tsx: reference-layout system entries, counts, and selection callbacks.
- src/renderer/components/ItemWorkspace.tsx: add-preset action for patch-only selections.
- src/renderer/components/OperationDialogs.tsx: only if an existing dialog primitive is reused for preset append confirmation.
- src/renderer/styles/layout.css, controls.css, operations.css, items.css: compact sidebar, preset rows, placeholder, and action states.
- tests/renderer/fake-api.ts: in-memory preset API implementation.
- tests/renderer/workspace-selection.test.tsx and tests/renderer/inspector-collapse.test.tsx: preserve existing selection/layout assertions and add the new action.
- tests/unit/ipc-contracts.test.ts: contract validation cases.
- tests/integration/recovery-mode.test.ts: corrupted presets enter read-only recovery.
- docs/superpowers/specs/2026-07-22-sidebar-presets-navigation-design.md: already committed design source; do not broaden it without a failing requirement.

## Task 1: Define the Preset Contract and Atomic State

Files:

- Create src/shared/preset-contracts.ts
- Create src/core/presets/preset-state.ts
- Test tests/unit/ipc-contracts.test.ts
- Test tests/integration/atomic-json-store.test.ts only if a state-store behavior needs a regression case

- [ ] Step 1: Add contract tests for valid and invalid preset inputs.

  Assert that a preset item must have kind patch, a non-empty safe relative path, and a UUID preset id. Assert that an empty name, empty items array, group item, absolute path, and parent traversal are rejected.

  Use these request shapes:

      const CreatePresetRequestSchema = z.object({
        name: z.string().trim().min(1).max(120),
        items: z.array(PresetItemReferenceSchema).min(1),
      });

      const AddPresetItemsRequestSchema = z.object({
        id: z.string().uuid(),
        items: z.array(PresetItemReferenceSchema).min(1),
      });

- [ ] Step 2: Run the focused contract test and verify it fails before implementation.

  Run: pnpm vitest run tests/unit/ipc-contracts.test.ts -t preset

  Expected: FAIL because the preset schemas and IPC methods do not exist.

- [ ] Step 3: Implement shared/preset-contracts.ts.

  Export PresetItemReferenceSchema, PresetSchema, PresetListSchema, CreatePresetRequestSchema, RenamePresetRequestSchema, DeletePresetRequestSchema, AddPresetItemsRequestSchema, InstallPresetRequestSchema, and PresetInstallResultSchema. The install result must contain installedCount and missingPaths.

  Use this state shape:

      export const PresetStateSchema = z.object({
        formatVersion: z.literal(1),
        presets: z.array(PresetSchema),
      });

- [ ] Step 4: Implement core/presets/preset-state.ts.

  Export createPresetStateStore(file) returning AtomicJsonStore<PresetState>. Use createAtomicJsonStore(file, PresetStateSchema). Keep the missing-file behavior consistent with settings, preview, and installation state stores.

- [ ] Step 5: Run the focused tests and typecheck.

  Run: pnpm vitest run tests/unit/ipc-contracts.test.ts -t preset

  Expected: PASS.

  Run: pnpm typecheck

  Expected: TypeScript: No errors found.

- [ ] Step 6: Commit the contract/state slice.

      git add src/shared/preset-contracts.ts src/core/presets/preset-state.ts tests/unit/ipc-contracts.test.ts
      git commit -m "feat: define local preset state contract"

## Task 2: Implement the Preset Service with Additive Installation

Files:

- Create src/core/presets/preset-service.ts
- Test tests/integration/preset-service.test.ts
- Modify src/core/paths/library-path.ts only if the service needs a small exported file-resolution helper; do not duplicate path-boundary logic.

- [ ] Step 1: Write integration tests against real temporary library/data/game directories.

  Cover these cases:

  1. Create a preset from two root and nested NPK references, list it, and verify data/presets.json contains no file copies.
  2. Duplicate item references are normalized to one entry.
  3. Group, missing, absolute, and traversal references are rejected without changing the state file.
  4. Rename and delete only change presets.json; NPK bytes remain.
  5. A missing reference appears in list output and install output.
  6. Installing a preset calls the existing install service with only existing patch references and leaves an unrelated enabled patch installed.

  The additive assertion must read the game directory before and after install and verify the unrelated target and its installation record remain.

- [ ] Step 2: Run the new integration test to capture the red state.

  Run: pnpm vitest run tests/integration/preset-service.test.ts

  Expected: FAIL because the preset service is not implemented.

- [ ] Step 3: Implement the service API.

  Export:

      export type PresetService = {
        list(): Promise<Result<readonly PresetDto[], PresetServiceError>>;
        create(request: CreatePresetRequest): Promise<Result<PresetDto, PresetServiceError>>;
        rename(request: RenamePresetRequest): Promise<Result<PresetDto, PresetServiceError>>;
        remove(request: DeletePresetRequest): Promise<Result<{ id: string }, PresetServiceError>>;
        addItems(request: AddPresetItemsRequest): Promise<Result<PresetDto, PresetServiceError>>;
        install(id: string): Promise<Result<PresetInstallResult, PresetServiceError>>;
      };

  The factory receives libraryRoot, preset state store, InstallService, createId, and now. Resolve each reference with resolveLibraryPath, verify it is an existing .npk file, and canonicalize separators to Windows-relative paths. Return explicit errors for duplicate names, missing items, invalid item kind, state corruption, state IO, and install failure.

- [ ] Step 4: Implement atomic CRUD and missing-reference enrichment.

  On a missing state file return an empty formatVersion 1 state in memory and write it on the first mutation. On a corrupted state file return a state-corrupted error so recovery-mode registration can preserve the source file. Every mutation reads the latest state, validates all entries, writes a new state atomically, and returns the updated DTO.

- [ ] Step 5: Implement additive install.

  Read the preset, resolve existing patch references, collect missing paths, and call installService.enableMany(existingItems) only when at least one existing item remains. Return installedCount and missingPaths on success. Propagate target-directory, transaction, and recovery errors without disabling any other item.

- [ ] Step 6: Run integration tests and inspect the state bytes.

  Run: pnpm vitest run tests/integration/preset-service.test.ts tests/integration/install-service.test.ts

  Expected: PASS, with no temporary files left in the preset fixture directory.

- [ ] Step 7: Commit the service slice.

      git add src/core/presets/preset-service.ts tests/integration/preset-service.test.ts
      git commit -m "feat: persist and install local presets"

## Task 3: Wire Shared IPC, Preload, Main Registration, and Recovery

Files:

- Modify src/shared/ipc-contracts.ts
- Modify src/preload/preload.ts
- Create src/main/ipc/preset-ipc.ts
- Modify src/main/ipc/register-ipc.ts
- Modify tests/unit/ipc-contracts.test.ts
- Modify tests/integration/recovery-mode.test.ts

- [ ] Step 1: Add IPC contract tests for each request and result.

  Validate list has no request, create/rename/delete/add/install requests parse, and install result allows missingPaths while keeping installedCount nonnegative.

- [ ] Step 2: Add channel constants and DnfApi methods.

  Add channels presetsList, presetsCreate, presetsRename, presetsDelete, presetsAddItems, and presetsInstall under the local-presets namespace. Import the shared preset schemas and expose typed methods returning ApiResult values.

- [ ] Step 3: Add preload validation and bridge methods.

  Add PresetResultSchema, PresetListResultSchema, PresetInstallResultSchema, and methods that parse request schemas before invoke. Keep contextIsolation and nodeIntegration settings unchanged.

- [ ] Step 4: Implement main preset IPC registration.

  Create registerPresetIpc with paths, getInstallService, mutationMutex, and recoveryState. Register list as read-only; wrap create/rename/delete/add/install in mutationMutex.runExclusive. When recoveryState.readOnly is true, return the same recovery error used by existing mutations. Construct the service with win32.join(paths.dataRoot, "presets.json").

- [ ] Step 5: Register the helper from register-ipc.ts.

  Call registerPresetIpc after the install binding is created so installPreset can reuse getInstallService. Do not create a second mutex or a second install service.

- [ ] Step 6: Add corrupted presets recovery coverage.

  Write malformed data/presets.json in the integration fixture, initialize the app path, and assert inspectRecoveryState includes presets.json and preset mutations do not overwrite its bytes.

- [ ] Step 7: Run the IPC/recovery tests and typecheck.

  Run: pnpm vitest run tests/unit/ipc-contracts.test.ts tests/integration/preset-service.test.ts tests/integration/recovery-mode.test.ts

  Expected: PASS.

- [ ] Step 8: Commit the IPC slice.

      git add src/shared/ipc-contracts.ts src/preload/preload.ts src/main/ipc/preset-ipc.ts src/main/ipc/register-ipc.ts tests/unit/ipc-contracts.test.ts tests/integration/recovery-mode.test.ts
      git commit -m "feat: expose preset IPC operations"

## Task 4: Add Renderer Navigation and Root/Unclassified Scopes

Files:

- Modify src/renderer/workspace/model.ts
- Modify src/renderer/workspace/useWorkspace.ts
- Modify src/renderer/components/WorkspaceApp.tsx
- Modify src/renderer/components/CategorySidebar.tsx
- Create or modify a focused renderer navigation test file: tests/renderer/navigation.test.tsx
- Modify tests/renderer/fake-api.ts
- Modify src/renderer/styles/layout.css and src/renderer/styles/toolbar.css

- [ ] Step 1: Write renderer tests for reference-layout navigation.

  Render the fake API and assert the sidebar order is 回收站, 全部, 未分类, 预设, 资源社区, followed by the category row. Click 未分类 and assert only root patch items are present. Click 资源社区 and assert a main-region heading or status with exact text 待构建 and no item grid. Assert clicking an existing category still scans that category.

- [ ] Step 2: Run the focused renderer test and verify it fails.

  Run: pnpm vitest run tests/renderer/navigation.test.tsx

  Expected: FAIL because the new system entries and navigation state do not exist.

- [ ] Step 3: Add NavigationSelection and explicit scope helpers.

  Add the union from the design document to model.ts. Keep categoryPath as a real path. Add helpers that identify a root patch using relativePath.split(/[\\/]/u).length === 1 and filter kind patch for unclassified.

- [ ] Step 4: Extend useWorkspace without breaking category commands.

  Expose root scanning and scoped item lists. Use includeDescendants=true for all-library scope, false for unclassified, and retain the existing category checkbox behavior. Do not pass system-entry names to client.scan.

- [ ] Step 5: Rebuild CategorySidebar markup and state wiring.

  Render an icon-only settings button in the top row, system navigation rows with counts, a separator, and the existing CategoryTree. Preserve category reorder callbacks and the recycle-bin callback. Add aria-current/aria-pressed semantics and tooltips for icon-only controls.

- [ ] Step 6: Route WorkspaceApp between item, preset, and placeholder views.

  Keep the existing ItemWorkspace for all, unclassified, and category scopes. Render the preset component from Task 5 for presets and a centered unframed placeholder with exact visible text 待构建 for community. Clear item selection when switching scopes, and keep settings/operation dialogs mounted only where their existing workflows need them.

- [ ] Step 7: Update layout styles to match reference image 1.

  Use stable sidebar width, compact 36px system rows, an 8px section gap and a 1px separator. Keep the global app toolbar separate. Ensure the sidebar and main workspace scroll independently and no new nested card is introduced.

- [ ] Step 8: Run the focused renderer tests and all existing renderer tests.

  Run: pnpm vitest run tests/renderer/navigation.test.tsx tests/renderer/category-tree.test.tsx tests/renderer/view-controls.test.tsx tests/renderer/workspace-selection.test.tsx

  Expected: PASS.

- [ ] Step 9: Commit the navigation slice.

      git add src/renderer/workspace/model.ts src/renderer/workspace/useWorkspace.ts src/renderer/components/WorkspaceApp.tsx src/renderer/components/CategorySidebar.tsx src/renderer/styles/layout.css src/renderer/styles/toolbar.css tests/renderer/navigation.test.tsx tests/renderer/fake-api.ts
      git commit -m "feat: add system navigation scopes"

## Task 5: Add Preset Renderer State, Dialogs, and Selection Action

Files:

- Create src/renderer/workspace/usePresets.ts
- Create src/renderer/components/PresetWorkspace.tsx
- Create src/renderer/components/PresetDialogs.tsx
- Modify src/renderer/components/WorkspaceApp.tsx
- Modify src/renderer/components/ItemWorkspace.tsx
- Modify src/renderer/workspace/useWorkspaceOperations.ts only for the typed create/append callback if the hook remains the operation boundary
- Modify src/renderer/styles/layout.css, operations.css, controls.css, and items.css
- Test tests/renderer/preset-workspace.test.tsx
- Modify tests/renderer/fake-api.ts

- [ ] Step 1: Write renderer tests for create, append, rename, delete, missing count, and install.

  Use a fake DnfApi that records createPreset, addItemsToPreset, renamePreset, deletePreset, and installPreset requests. Assert patch-only selection exposes 加入预设, group selection does not. Assert submitting a name sends selected patch relative paths, installation sends the preset id, and an install result with missingPaths shows the missing file names without hiding successful items.

- [ ] Step 2: Run the focused test and verify it fails.

  Run: pnpm vitest run tests/renderer/preset-workspace.test.tsx

  Expected: FAIL because the hook, components, and fake API methods do not exist.

- [ ] Step 3: Implement usePresets.

  Load listPresets on client availability, expose refresh, createFromSelection, addItems, rename, remove, and install, and route ApiResult errors through the existing Notice type. Keep a busy id or boolean so only the triggering preset command is disabled while a mutation runs.

- [ ] Step 4: Implement PresetDialogs.

  Reuse Dialog and existing form conventions. The create form receives the selected patch references and posts createPreset. The append form lists current presets and supports create-new as a separate submit path. Escape and close-button behavior must restore focus to the triggering action.

- [ ] Step 5: Implement PresetWorkspace.

  Render a heading, preset count, and stable rows. Each row shows name, item count, missing count when nonzero, install button, and a compact menu or icon actions for rename/delete. Selecting a row shows its referenced patch names in the main content without copying them. Read-only mode disables mutations but keeps list inspection.

- [ ] Step 6: Add the ItemWorkspace selection action.

  Add a Lucide icon button labelled 加入预设 to the existing selection toolbar only when selectedItems contains patches and no groups. Preserve the current enable, rename, move, group, and recycle commands and keep the toolbar dimensions stable.

- [ ] Step 7: Wire WorkspaceApp and notices.

  Connect preset hook, dialogs, selected references, and navigation selection. On successful create/append/install, refresh the relevant list and retain the existing toast/status semantics. Do not clear unrelated enabled state after install.

- [ ] Step 8: Run renderer tests and lint.

  Run: pnpm vitest run tests/renderer/preset-workspace.test.tsx tests/renderer/navigation.test.tsx tests/renderer/workspace-selection.test.tsx

  Expected: PASS.

  Run: pnpm lint

  Expected: Biome reports no fixes needed.

- [ ] Step 9: Commit the preset UI slice.

      git add src/renderer/workspace/usePresets.ts src/renderer/components/PresetWorkspace.tsx src/renderer/components/PresetDialogs.tsx src/renderer/components/WorkspaceApp.tsx src/renderer/components/ItemWorkspace.tsx src/renderer/workspace/useWorkspaceOperations.ts src/renderer/styles/layout.css src/renderer/styles/operations.css src/renderer/styles/controls.css src/renderer/styles/items.css tests/renderer/preset-workspace.test.tsx tests/renderer/fake-api.ts
      git commit -m "feat: create and install presets from selection"

## Task 6: Add Real Electron Preset E2E and Regression Coverage

Files:

- Create tests/e2e/presets.e2e.ts
- Modify tests/e2e/view-controls.e2e.ts only if the new sidebar order changes an accessible locator.
- Modify tests/renderer/inspector-collapse.test.tsx and tests/renderer/appearance-settings.test.tsx only when a locator moved from the old toolbar.

- [ ] Step 1: Create an E2E fixture with two root NPK files, one nested NPK, a game directory, and an unrelated enabled patch.

  Launch Electron with a temporary cwd, mock the directory/file dialogs through application.evaluate, and wait for the typed API and main workspace.

- [ ] Step 2: Exercise the complete flow.

  Select two NPK cards, click 加入预设, create a named preset, close/reopen the app, click 预设, and assert the name and count persist. Install it, assert the two targets exist in the game directory, and assert the unrelated target still exists. Delete the preset and assert its NPK files remain.

- [ ] Step 3: Add missing-reference coverage.

  Remove one referenced NPK after creation, relaunch, assert the preset row reports one missing item, install it, and assert the existing item is installed while the missing path is reported.

- [ ] Step 4: Run the focused E2E.

  Run: pnpm build

  Run: pnpm exec playwright test tests/e2e/presets.e2e.ts

  Expected: PASS with no page errors and no remote requests.

- [ ] Step 5: Commit the E2E slice.

      git add tests/e2e/presets.e2e.ts tests/e2e/view-controls.e2e.ts tests/renderer/inspector-collapse.test.tsx tests/renderer/appearance-settings.test.tsx
      git commit -m "test: cover preset persistence and additive install"

## Task 7: Full Verification, Documentation, and Audit

Files:

- Modify docs/USER_GUIDE.md with the preset workflow and new sidebar entries.
- Modify docs/FUNCTION_MODULES.md with preset service ownership and IPC boundary.
- Modify docs/MAINTENANCE.md with presets.json recovery and path-validation notes.
- Modify E:/BaiduSyncdisk/知识库/DNF补丁管理器/功能请求.md to record the request resolution and evidence.

- [ ] Step 1: Add user-facing and maintenance documentation.

  Document that presets reference existing NPK paths, do not copy files, install additively, preserve unrelated enabled patches, and report missing references. Document that Resource Community is a local 待构建 placeholder and does not access remote services.

- [ ] Step 2: Run complete verification.

  Run: pnpm test

  Expected: all renderer, integration, and unit tests pass.

  Run: pnpm typecheck

  Expected: TypeScript: No errors found.

  Run: pnpm lint

  Expected: Biome reports no fixes needed.

  Run: pnpm build

  Expected: electron-vite produces out/main, out/preload, and out/renderer.

  Run: pnpm test:e2e

  Expected: all Electron E2E tests pass, including presets.

  Run: 启动DNF补丁管理器.bat --check

  Expected: Launcher check passed and the Electron path points to the current repository.

- [ ] Step 3: Inspect desktop screenshots at 1280x720, 1440x900, and 1920x1080.

  Verify the sidebar order and active states match image 1, the main workspace has no right-side inspector, the community view shows 待构建, and no text or controls overlap.

- [ ] Step 4: Self-audit Git scope.

  Run: git diff --check

  Run: git status --short --branch

  Confirm only intended source, tests, docs, and ignored build/screenshot outputs changed. Do not push remote.

- [ ] Step 5: Commit documentation and final audit.

      git add docs/USER_GUIDE.md docs/FUNCTION_MODULES.md docs/MAINTENANCE.md
      git commit -m "docs: document presets and navigation"

## Plan Self-Review

- Spec coverage: navigation, unclassified scope, preset references, additive installation, missing references, recovery, resource placeholder, accessibility, and all requested verification gates each have a task.
- Placeholder scan: no TBD, TODO, FIXME, or unspecified implementation step is used.
- Type consistency: Preset, PresetItemReference, NavigationSelection, createPreset, addItemsToPreset, installPreset, and PresetInstallResult names are used consistently across the contract, service, preload, renderer, and tests.
- Scope: no online community, NPK copying, remote access, or unrelated install/recovery refactor is included.

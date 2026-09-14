# Card Preview Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-times hover previews, blue/yellow card borders, and same-directory same-name image previews for patch and group cards.

**Architecture:** Keep the existing preview-picker IPC entry point, but copy the selected image into the item directory with the item basename. The scanner exposes matching preview paths, a restricted `dnf-library` protocol serves those files, and the renderer uses that URL for the zoom overlay. Existing managed preview state remains readable but does not override the same-name file rule.

**Tech Stack:** Electron protocol handlers, Node `fs/promises`, React, CSS, Vitest, Playwright Electron E2E.

---

### Task 1: Define Same-Name Library Preview Files

**Files:**
- Create: `src/core/library/library-preview.ts`
- Create: `tests/integration/library-preview.test.ts`
- Modify: `src/shared/library-dto.ts`
- Modify: `src/core/library/scanner.ts`
- Modify: `tests/integration/scanner.test.ts`

- [ ] **Step 1: Write failing tests**

Cover patch copy (`A.npk` + source image -> sibling `A.<ext>`), group copy (group directory -> same-name image inside it), replacement of all older same-basename images, unsupported/unsafe input rejection, scanner same-name discovery, and mismatched-name hiding.

- [ ] **Step 2: Run the focused tests**

Run `pnpm exec vitest run tests/integration/library-preview.test.ts tests/integration/scanner.test.ts`. Expected: FAIL because the helper and group preview DTO field do not exist.

- [ ] **Step 3: Implement the helper and scanner data**

Use `resolveLibraryPath` for traversal protection. Validate the existing image extensions, copy to the item directory using the item basename and selected extension, then remove older matching image candidates. Extend `GroupItem` with a nullable `previewRelativePath` (backward-compatible schema default) and reuse the case-insensitive basename matcher for patch and group scans.

- [ ] **Step 4: Re-run the focused tests**

Run the same command. Expected: all library-preview and scanner tests pass.

- [ ] **Step 5: Commit**

Run `git add src/core/library/library-preview.ts tests/integration/library-preview.test.ts src/shared/library-dto.ts src/core/library/scanner.ts tests/integration/scanner.test.ts` and `git commit -m "feat: copy previews beside library items"`.

### Task 2: Serve Library Preview Files Safely

**Files:**
- Modify: `src/main/managed-asset-protocol.ts`
- Modify: `src/main/main.ts`
- Modify: `src/core/library/library-preview.ts`
- Create: `tests/integration/library-preview-protocol.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Test that a relative path produces a `dnf-library` URL, safe paths resolve under the configured library root, and traversal, absolute paths, query strings, hashes, unsupported extensions, and missing files are rejected.

- [ ] **Step 2: Implement the protocol**

Register `dnf-library` beside `dnf-asset`. Its handler may read only the configured library root, returns the correct image MIME type, and returns 404 for invalid or missing files. Keep the managed-asset protocol unchanged.

- [ ] **Step 3: Verify and commit**

Run `pnpm exec vitest run tests/integration/library-preview-protocol.test.ts`, then commit with `git add src/main/managed-asset-protocol.ts src/main/main.ts src/core/library/library-preview.ts tests/integration/library-preview-protocol.test.ts` and `git commit -m "feat: serve library preview images safely"`.

### Task 3: Connect Selection and Snapshot Decoration

**Files:**
- Modify: `src/main/ipc/preview-ipc.ts`
- Modify: `src/main/ipc/register-ipc.ts`
- Modify: `src/main/ipc/decorate-snapshot.ts`
- Modify: `src/shared/library-dto.ts`
- Modify: `tests/integration/preview-service.test.ts`
- Modify: `tests/e2e/library-workflow.e2e.ts`

- [ ] **Step 1: Write failing selection tests**

Assert the existing picker copies patch and group images to the required directories, scan results expose `dnf-library` URLs only for matching files, and a managed binding without a matching file cannot supply a card preview.

- [ ] **Step 2: Connect the picker**

Pass `paths.libraryRoot` to `registerPreviewIpc`, call the library copy helper after the native picker returns, preserve cancellation and mutation serialization, and return the local preview URL.

- [ ] **Step 3: Decorate matching files only**

Use scanned `previewRelativePath` values and `libraryPreviewUrl` for patch/group `previewUrl`. Do not let `previews.json` override a missing matching file. Keep recovery parsing and legacy managed-asset APIs readable.

- [ ] **Step 4: Add Electron coverage**

Create a source image, stub the native picker, select patch and group previews, assert copied locations and `dnf-library` image sources, and assert an incorrectly named image is not rendered.

- [ ] **Step 5: Verify and commit**

Run `pnpm exec vitest run tests/integration/preview-service.test.ts tests/integration/library-preview.test.ts` and `pnpm exec playwright test tests/e2e/library-workflow.e2e.ts`. Commit with `git add src/main/ipc/preview-ipc.ts src/main/ipc/register-ipc.ts src/main/ipc/decorate-snapshot.ts src/shared/library-dto.ts tests/integration/preview-service.test.ts tests/e2e/library-workflow.e2e.ts` and `git commit -m "feat: use same-name library previews"`.

### Task 4: Add Card Hover and Selection UI

**Files:**
- Modify: `src/renderer/components/ItemWorkspace.tsx`
- Modify: `src/renderer/styles/items.css`
- Modify: `tests/renderer/item-preview.test.tsx`
- Modify: `tests/e2e/view-controls.e2e.ts`

- [ ] **Step 1: Write failing renderer assertions**

Assert the upper-left circular affordance appears on card hover, a matching preview gets a zoom layer, a missing preview does not, double-click still opens the picker, and the card keeps its existing `aria-pressed` state.

- [ ] **Step 2: Add the hover-zone markup**

Add a non-layout overlay sibling containing the circular affordance and, when `item.previewUrl` exists, the zoom image. Keep the picker handler on `.item-preview` and do not nest a new interactive control inside the card button.

- [ ] **Step 3: Add stable CSS states**

Use the card shell as the positioning context. Reveal the dot on card hover, show the zoom overlay while its hover zone is active, set the zoom width to `200%`, preserve the source image aspect ratio without letterboxing, animate opacity and a subtle upper-left scale-in, keep the overlay outside the card overflow, use the blue primary border for hover, and use the yellow warning border for `aria-pressed="true"`.

- [ ] **Step 4: Verify and commit**

Run `pnpm exec vitest run tests/renderer/item-preview.test.tsx tests/renderer/view-controls.test.tsx`, `pnpm build`, and `pnpm exec playwright test tests/e2e/view-controls.e2e.ts`. Assert the zoom layer does not change the card bounding box, follows the source aspect ratio, has a transform transition, and selected hover remains yellow. Commit with `git add src/renderer/components/ItemWorkspace.tsx src/renderer/styles/items.css tests/renderer/item-preview.test.tsx tests/e2e/view-controls.e2e.ts` and `git commit -m "feat: add card preview hover zoom"`.

### Task 5: Full Verification

**Files:** No source changes expected.

- [ ] **Step 1: Run `pnpm lint` and `pnpm typecheck`**

Expected: Biome reports no diagnostics and TypeScript reports no errors.

- [ ] **Step 2: Run `pnpm test -- --no-file-parallelism --maxWorkers=1 --minWorkers=1 --testTimeout=30000`**

Expected: all existing and new Vitest files pass.

- [ ] **Step 3: Run `pnpm test:e2e`**

Expected: the build succeeds and all Electron Playwright tests pass.

- [ ] **Step 4: Run `git diff --check`, `git status --short --branch`, and `git log --oneline --decorate -8`**

Expected: a clean `codex/卡片` worktree with each implementation slice committed and no changes on `master`.

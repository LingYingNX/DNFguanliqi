# Context Menu Category Move Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the patch context menu's flat move list with a Windows-style recursive menu that exposes the full category tree and refreshes counts immediately after a move.

**Architecture:** Extract the menu rendering and recursive submenu state into a focused `ContextMenu` component. `ItemWorkspace` will continue to build the action data and invoke existing callbacks, while `WorkspaceApp` will always derive move targets from the root navigation snapshot. Existing IPC and operation refresh semantics remain unchanged.

**Tech Stack:** React, TypeScript, Lucide React, CSS, Vitest Testing Library, Playwright Electron E2E.

---

### Task 1: Lock the recursive menu contract with renderer tests

**Files:**
- Modify: `E:\codex目录\DNF\tests\renderer\operations.test.tsx`
- Modify: `E:\codex目录\DNF\tests\renderer\fake-api.ts` only if the fixture needs additional root categories

- [ ] **Step 1: Replace flat move assertions with tree assertions**

Use a fixture containing two root categories and a nested child. Assert that hovering `移动` renders only root categories first, that hovering a root category with children opens its child menu, that the parent menu remains mounted, and that the current category button is disabled.

- [ ] **Step 2: Add the regression for nested-directory targets**

Render the workspace with `categoryPath` under one root category and assert that a different root category remains available from the move menu. This encodes why the target source must be `navigationSnapshot`, not the current workspace snapshot.

- [ ] **Step 3: Run the focused renderer tests and verify the new assertions fail**

Run `rtk npm test -- --run tests/renderer/operations.test.tsx`. The recursive submenu assertions should fail against the current flat implementation before the component changes.

### Task 2: Extract the recursive context menu component

**Files:**
- Create: `E:\codex目录\DNF\src\renderer\components\ContextMenu.tsx`
- Modify: `E:\codex目录\DNF\src\renderer\components\ItemWorkspace.tsx`

- [ ] **Step 1: Define action and menu item types**

`ContextMenu` accepts the existing action shape plus optional recursive `children`. Each item renders as an accessible `menuitem`; items with children use `aria-haspopup="menu"` and open their child menu on pointer enter, focus, or keyboard navigation.

- [ ] **Step 2: Render recursive children at `left: 100%`**

Keep each submenu inside the parent item wrapper. Use the existing `card`, `list`, and `element` classes so CSS owns the visual contract. Do not add a pointer corridor or a gap between levels. Clicking a leaf calls the supplied action and closes the whole menu.

- [ ] **Step 3: Move document-level close behavior into the component**

Preserve the current outside `pointerdown` and `Escape` listeners. Pointer events inside any nested menu must stop propagation so entering a child does not close the root menu.

- [ ] **Step 4: Replace inline JSX in `ItemWorkspace` with the component**

Keep `ItemWorkspace` responsible for building actions and for passing `contextMenu.selectedItems` to `onMoveTo`. Remove the one-level `moveMenuOpen` state and inline submenu markup.

### Task 3: Use the complete root category tree

**Files:**
- Modify: `E:\codex目录\DNF\src\renderer\components\WorkspaceApp.tsx`

- [ ] **Step 1: Preserve category hierarchy while annotating the current path**

Change `moveTargets` to return recursive targets with `children`. Walk `workspace.navigationSnapshot.childCategories` from the root, mark only the normalized current category path disabled, and retain each category's relative path.

- [ ] **Step 2: Always pass `workspace.navigationSnapshot`**

The `ItemWorkspace` prop must use the root snapshot for both root and nested navigation. This makes a patch viewed under `男鬼剑` able to target sibling and other root categories without changing the move IPC request.

- [ ] **Step 3: Run type checking and focused renderer tests**

Run `rtk npm test -- --run tests/renderer/operations.test.tsx` and `rtk npm run typecheck` (or the repository's equivalent script from `package.json`). Fix only failures caused by this contract change.

### Task 4: Apply the confirmed menu visual contract

**Files:**
- Modify: `E:\codex目录\DNF\src\renderer\styles\items.css`

- [ ] **Step 1: Remove the level gap and pointer corridor**

Set the submenu panel to `left: 100%` and remove `.item-context-submenu::after`. Keep the existing top alignment and menu dimensions.

- [ ] **Step 2: Remove menu shadows and retain the small radius**

Delete the menu `box-shadow` declaration and keep `border-radius: 6px` for root and nested panels. Do not alter unrelated card, preview, or drag styles.

### Task 5: Verify movement and immediate count refresh

**Files:**
- Modify: `E:\codex目录\DNF\tests\e2e\library-workflow.e2e.ts`
- Modify: `E:\codex目录\DNF\src\renderer\workspace\useWorkspace.ts` only if the existing refresh implementation is incomplete

- [ ] **Step 1: Add an Electron regression scenario**

Create multiple root categories with a nested `男鬼剑` directory, open the source category, enter the move menu one level at a time, move a patch into another category, and assert that the source and destination counts update without navigating away.

- [ ] **Step 2: Run the renderer and E2E suites**

Run `rtk npm test -- --run tests/renderer/operations.test.tsx` and the repository's existing E2E command from `package.json`. Record any environment-blocked E2E result explicitly.

- [ ] **Step 3: Inspect the diff and commit the implementation**

Run `rtk git diff --check` and `rtk git status --short`, then commit only the design, plan, component, workspace, CSS, and test changes with `rtk git add ...` and `rtk git commit -m "fix: make category move menu recursive"`.

## Self-review

- The plan covers recursive rendering, root snapshot selection, current-category disabling, no-gap/no-shadow styling, and immediate refresh verification from the approved design.
- No new IPC contract, drag behavior, dialogs, preview layout, or unrelated card styling is included.
- The target type is recursive in every task that consumes it; leaf clicks still call the existing `onMoveTo(targetPath, selectedItems)` callback.

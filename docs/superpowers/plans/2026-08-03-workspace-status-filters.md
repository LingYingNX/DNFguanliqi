# Workspace Status Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible all/enabled/disabled filters with counts, move search before view controls, and add spacing above the patch cards.

**Architecture:** Keep filtering and counts in `useWorkspace`, where the current scoped item collection already exists. Pass the filter state, counts, and setter through `WorkspaceApp` into `ItemWorkspace`; keep the component responsible only for rendering controls. Add the status row between the existing toolbar and the loading/empty/card content.

**Tech Stack:** React, TypeScript, Vitest Testing Library, CSS, Biome, Electron build.

---

### Task 1: Define the three-state filter and prove filtering behavior

**Files:**
- Modify: `src/renderer/workspace/model.ts:11-25`
- Modify: `tests/renderer/view-controls.test.tsx:1-50`

- [ ] **Step 1: Write the failing integration test**

Extend the existing view-controls test file with a test that renders `WORKSPACE_SNAPSHOT`, waits for the cards, and asserts the user-visible status controls and filtering behavior:

```tsx
it("filters cards by enabled state while keeping scope counts stable", async () => {
  render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);
  await screen.findByText("coat.npk");

  expect(screen.getByRole("button", { name: "全部 3" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "已启用 1" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "未启用 2" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "已启用 1" }));

  expect(screen.getByRole("button", { name: "已启用 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText("coat.npk")).toBeInTheDocument();
  expect(screen.queryByText("sword.npk")).not.toBeInTheDocument();
  expect(screen.queryByText("套装")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "未启用 2" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "未启用 2" }));

  expect(screen.getByText("sword.npk")).toBeInTheDocument();
  expect(screen.getByText("套装")).toBeInTheDocument();
  expect(screen.queryByText("coat.npk")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify the expected red failure**

Run: `rtk vitest run tests/renderer/view-controls.test.tsx`

Expected: FAIL because `全部 3`, `已启用 1`, and `未启用 2` controls do not exist yet.

- [ ] **Step 3: Implement the minimal model behavior**

In `src/renderer/workspace/model.ts`, change the type and matching predicate:

```ts
export type EnabledFilter = "all" | "enabled" | "disabled";

export function itemMatches(item: WorkspaceItem, query: string, filter: EnabledFilter): boolean {
  const matchesQuery = item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  const matchesEnabled =
    filter === "all" || (filter === "enabled" ? item.enabled : !item.enabled);
  return matchesQuery && matchesEnabled;
}
```

- [ ] **Step 4: Run the focused test and confirm it still fails for the missing UI wiring**

Run: `rtk vitest run tests/renderer/view-controls.test.tsx`

Expected: FAIL on the missing status buttons, confirming the test exercises the new UI contract rather than only the model predicate.

### Task 2: Expose status counts and filter state from the workspace hook

**Files:**
- Modify: `src/renderer/workspace/model.ts:11-12`
- Modify: `src/renderer/workspace/useWorkspace.ts:1-3,119-131,245-269`
- Modify: `src/renderer/components/WorkspaceApp.tsx:118-180`

- [ ] **Step 1: Add the stable count shape**

In `src/renderer/workspace/model.ts`, add the type immediately after `EnabledFilter`:

```ts
export type EnabledCounts = {
  readonly all: number;
  readonly enabled: number;
  readonly disabled: number;
};
```

- [ ] **Step 2: Derive counts from the unfiltered scoped items**

In `src/renderer/workspace/useWorkspace.ts`, import `EnabledCounts` and add this memo after `items`:

```ts
const enabledCounts = useMemo<EnabledCounts>(
  () => ({
    all: items.length,
    enabled: items.filter((item) => item.enabled).length,
    disabled: items.filter((item) => !item.enabled).length,
  }),
  [items],
);
```

Return `enabledCounts` alongside `enabledFilter`, `setEnabledFilter`, and `visibleItems`.

- [ ] **Step 3: Thread the hook values into `ItemWorkspace`**

In `src/renderer/components/WorkspaceApp.tsx`, pass these props to `ItemWorkspace`:

```tsx
enabledCounts={workspace.enabledCounts}
enabledFilter={workspace.enabledFilter}
onEnabledFilterChange={workspace.setEnabledFilter}
```

- [ ] **Step 4: Run TypeScript to identify any incomplete prop wiring**

Run: `rtk tsc --noEmit`

Expected: FAIL only until the corresponding `ItemWorkspaceProps` fields are added in Task 3; no unrelated errors should be introduced.

### Task 3: Render the status row and reorder the toolbar

**Files:**
- Modify: `src/renderer/components/ItemWorkspace.tsx:1-71,331-373`
- Modify: `src/renderer/styles/layout.css:350-405`

- [ ] **Step 1: Add the component contract**

Import `EnabledCounts` and `EnabledFilter`, then add these fields to `ItemWorkspaceProps`:

```ts
readonly enabledCounts: EnabledCounts;
readonly enabledFilter: EnabledFilter;
readonly onEnabledFilterChange: (filter: EnabledFilter) => void;
```

- [ ] **Step 2: Move the search field before the view controls**

Inside `.workspace-heading-actions`, render the existing `.workspace-search-field` first, then the existing `.view-mode-control`, then the optional descendant toggle. Preserve the current input label and search behavior.

- [ ] **Step 3: Add the status filter controls below the toolbar**

Insert this element immediately after `.workspace-heading` and before the loading/empty/card conditional:

```tsx
<fieldset className="enabled-filter-control" aria-label="启用状态">
  <button
    aria-pressed={props.enabledFilter === "all"}
    onClick={() => props.onEnabledFilterChange("all")}
    type="button"
  >
    全部 {props.enabledCounts.all}
  </button>
  <button
    aria-pressed={props.enabledFilter === "enabled"}
    onClick={() => props.onEnabledFilterChange("enabled")}
    type="button"
  >
    已启用 {props.enabledCounts.enabled}
  </button>
  <button
    aria-pressed={props.enabledFilter === "disabled"}
    onClick={() => props.onEnabledFilterChange("disabled")}
    type="button"
  >
    未启用 {props.enabledCounts.disabled}
  </button>
</fieldset>
```

- [ ] **Step 4: Add only the layout styles needed for the new row**

Keep the existing toolbar styling and add:

```css
.enabled-filter-control {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  padding: 12px 0 0;
  border: 0;
}

.enabled-filter-control button {
  min-height: 28px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text-secondary);
  background: var(--color-surface);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.enabled-filter-control button:hover,
.enabled-filter-control button[aria-pressed="true"] {
  border-color: var(--color-primary);
  color: var(--color-text-primary);
  background: var(--color-elevated);
}
```

Remove the auto margin from `.workspace-search-field` so the first control remains on the left:

```css
.workspace-search-field {
  width: min(360px, 32vw);
  margin-left: 0;
}
```

- [ ] **Step 5: Run the focused renderer tests and confirm the new UI is green**

Run: `rtk vitest run tests/renderer/view-controls.test.tsx tests/renderer/workspace.test.tsx`

Expected: PASS, including the new status filter test and existing search/view behavior.

### Task 4: Lock down DOM order, search composition, and empty state

**Files:**
- Modify: `tests/renderer/view-controls.test.tsx:40-50`

- [ ] **Step 1: Add the layout assertions**

Extend the existing layout test with these assertions:

```tsx
const search = screen.getByRole("searchbox", { name: "搜索补丁" });
const viewControls = screen.getByRole("group", { name: "项目视图" });
const statusFilters = screen.getByRole("group", { name: "启用状态" });
const cards = screen.getByRole("region", { name: "补丁项目" });

expect(search.compareDocumentPosition(viewControls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
expect(statusFilters.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
```

Add a search-plus-status assertion to the status test:

```tsx
fireEvent.change(screen.getByRole("searchbox", { name: "搜索补丁" }), {
  target: { value: "coat" },
});
expect(screen.queryByText("coat.npk")).not.toBeInTheDocument();
```

This confirms the selected `未启用` state still combines with search instead of replacing it.

- [ ] **Step 2: Run the focused tests**

Run: `rtk vitest run tests/renderer/view-controls.test.tsx tests/renderer/workspace.test.tsx`

Expected: PASS with no accessibility role or ordering failures.

### Task 5: Verify the complete change

**Files:**
- Verify only: files changed by Tasks 1-4

- [ ] **Step 1: Run all renderer tests**

Run: `rtk vitest run tests/renderer`

Expected: all renderer test files pass.

- [ ] **Step 2: Run the full Vitest suite**

Run: `rtk vitest run`

Expected: all existing and new tests pass.

- [ ] **Step 3: Run static checks**

Run: `rtk tsc --noEmit`

Expected: TypeScript completes successfully.

Run: `rtk lint`

Expected: Biome/lint completes successfully with no new diagnostics.

- [ ] **Step 4: Run the relevant E2E view-control test**

Run: `rtk playwright test tests/e2e/view-controls.e2e.ts`

Expected: the existing grid/list and thumbnail behavior remains passing.

- [ ] **Step 5: Check the final diff and workspace boundary**

Run: `rtk git diff --check`

Expected: no whitespace errors.

Run: `rtk git status --short`

Expected: only the intended C盘 worktree changes are present; no path under `E:\codex目录\DNF` is touched.

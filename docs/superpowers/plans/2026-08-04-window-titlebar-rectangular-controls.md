# Window Titlebar Rectangular Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the custom window controls as connected rectangular buttons with the close control aligned to the window's right edge.

**Architecture:** Keep `WindowTitleBar` and window-control IPC unchanged. Change only the `.window-controls` and `.window-control-button` CSS contract, then update the existing Electron E2E test to measure the new right edge and computed square corners.

**Tech Stack:** React 19, CSS, Electron, Playwright, Vitest, Biome.

---

### Task 1: Titlebar Control Styling

**Files:**
- Modify: `src/renderer/styles/toolbar.css:60-105`
- Test: `tests/e2e/window-titlebar.e2e.ts:47-53`

- [ ] **Step 1: Change the E2E expectation before changing the stylesheet**

Replace the former 12px right inset assertion with right-edge alignment, and assert the controls use square corners:

```ts
expect(Math.abs(viewport.width - closeBox.x - closeBox.width)).toBeLessThan(1);
const controlCorners = await controls.locator("button").evaluateAll((buttons) =>
  buttons.map((button) => getComputedStyle(button).borderTopLeftRadius),
);
expect(controlCorners).toEqual(["0px", "0px", "0px"]);
```

- [ ] **Step 2: Run the E2E test to verify it fails**

Run:

```text
rtk pnpm build
rtk pnpm exec playwright test tests/e2e/window-titlebar.e2e.ts
```

Expected: FAIL because the close button remains 12px from the right edge and each control has a 4px radius.

- [ ] **Step 3: Apply the minimal titlebar CSS change**

In `.window-controls`, use no inter-button gap and no horizontal padding while retaining the existing 2px vertical padding:

```css
.window-controls {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 2px 0;
  -webkit-app-region: no-drag;
}
```

In `.window-control-button`, replace the rounded corner declaration with a square corner declaration:

```css
border-radius: 0;
```

- [ ] **Step 4: Run the E2E test to verify the behavior passes**

Run:

```text
rtk pnpm build
rtk pnpm exec playwright test tests/e2e/window-titlebar.e2e.ts
```

Expected: PASS; controls remain clickable and the close button aligns to the viewport right edge.

- [ ] **Step 5: Keep the worktree uncommitted**

Do not stage, commit, push, or otherwise alter Git history. The user requested manual Git control.

### Task 2: Verification

**Files:**
- Modify: none
- Test: `tests/e2e/window-titlebar.e2e.ts`

- [ ] **Step 1: Run focused static and build validation**

Run:

```text
rtk pnpm exec biome check src/renderer/styles/toolbar.css tests/e2e/window-titlebar.e2e.ts
rtk pnpm typecheck
rtk pnpm build
rtk git diff --check
```

Expected: all commands exit 0. Do not report the full-suite lint result as passing unless every existing worktree format difference also passes.

- [ ] **Step 2: Report the validation boundary**

Report the focused E2E result, static check, typecheck, build, diff check, files written, and any unrelated existing full-lint failure. State that Git remains uncommitted.

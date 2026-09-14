# Wallpaper Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make wallpaper temperature and position controls visibly effective, set the default opacity to 50, import and activate wallpapers with default controls, and present the five wallpaper slots as a scrollable vertical 16:9 list with contextual delete controls.

**Architecture:** Keep appearance settings in the existing `AppearanceSettings` contract. `useAppearance` will derive CSS variables for the wallpaper effect layer, while `toolbar.css` consumes those variables. `AppearanceDialog` will keep the existing five-slot data model and change only slot markup and layout styling; IPC will import and activate a wallpaper atomically and reset its wallpaper controls while preserving theme and colors.

**Tech Stack:** React 19, TypeScript, Electron, CSS custom properties, Vitest, Testing Library, Playwright.

---

### Task 1: Lock the new defaults and effect contract with failing tests

**Files:**
- Modify: `tests/integration/appearance-state.test.ts`
- Modify: `tests/renderer/appearance-settings.test.tsx`
- Modify: `tests/e2e/appearance.e2e.ts`

- [ ] **Step 1: Update default-value assertions to require opacity 50**

Change renderer fixtures and assertions that describe the default appearance so a newly created appearance has `opacity: 50`; import tests should verify that the returned active wallpaper uses the reset control values.

- [ ] **Step 2: Add renderer assertions for temperature and position updates**

In `tests/renderer/appearance-settings.test.tsx`, open the appearance dialog, move the `色温`, `左右移动`, and `上下移动` range inputs, and assert that `updateAppearance` receives `temperature`, `positionX`, and `positionY` with the corresponding persisted values. Assert the initial opacity slider value is `50` and the reset button submits `opacity: 50`.

```tsx
fireEvent.change(screen.getByRole("slider", { name: /色温/u }), { target: { value: "75" } });
fireEvent.change(screen.getByRole("slider", { name: /左右移动/u }), { target: { value: "75" } });
fireEvent.change(screen.getByRole("slider", { name: /上下移动/u }), { target: { value: "25" } });
await waitFor(() =>
  expect(update).toHaveBeenLastCalledWith(
    expect.objectContaining({ temperature: 50, positionX: 75, positionY: 25 }),
  ),
);
```

- [ ] **Step 3: Add renderer assertions for empty and populated slot controls**

Assert that empty slots render four `.appearance-wallpaper-placeholder` elements and no delete buttons, while a populated slot renders the `img` and exactly one delete button. Add `data-slot={slot}` to each slot item so the E2E and renderer assertions address a specific slot without depending on DOM order.

- [ ] **Step 4: Update the E2E expectations to the new default**

Keep the post-import opacity expectation in `tests/e2e/appearance.e2e.ts` at `0.5`, and add assertions for a nonzero temperature filter variable, X/Y background-position variables after slider changes, a 16:9 slot ratio, hidden-to-visible delete behavior on hover, and `scrollHeight > clientHeight` for the slot list.

- [ ] **Step 5: Run the focused tests and verify they fail for the missing implementation**

Run:

```bash
pnpm exec vitest run tests/renderer/appearance-settings.test.tsx
pnpm exec vitest run --config vitest.integration.config.ts tests/integration/appearance-state.test.ts
```

Expected: failures identify the old opacity default and absent effect/slot behavior; do not change implementation in this step.

### Task 2: Implement default opacity and wallpaper effect variables

**Files:**
- Modify: `src/core/state/schemas.ts:63-76`
- Modify: `src/renderer/styles/tokens.css:39-45`
- Modify: `src/renderer/workspace/useAppearance.ts:24-42`
- Modify: `src/renderer/styles/toolbar.css:26-39`

- [ ] **Step 1: Set the persisted and CSS startup defaults**

Change `defaultAppearanceSettings().opacity` to `50` and `--wallpaper-opacity` to `0.5`. The existing reset code already reads the shared wallpaper defaults, so it will follow the new value without a second default source.

- [ ] **Step 2: Derive temperature and background-position variables in `useAppearance`**

Inside the existing appearance effect, derive these values from the persisted settings:

```ts
const temperatureMagnitude = Math.abs(appearance.temperature) / 100;
const temperatureHue = appearance.temperature > 0
  ? -temperatureMagnitude * 18
  : temperatureMagnitude * 18;
root.style.setProperty(
  "--wallpaper-temperature-filter",
  `sepia(${temperatureMagnitude * 0.35}) hue-rotate(${temperatureHue}deg)`,
);
root.style.setProperty("--wallpaper-position-x", `${appearance.positionX}%`);
root.style.setProperty("--wallpaper-position-y", `${appearance.positionY}%`);
```

Keep the existing persisted `--appearance-temperature`, `--wallpaper-position-x`, and `--wallpaper-position-y` variables so the public CSS state remains inspectable.

- [ ] **Step 3: Consume the new variables in the wallpaper pseudo-element**

Change `.app-shell::before` to use `inset: 0`, `background-position: var(--wallpaper-position-x) var(--wallpaper-position-y)`, and `background-size: cover`. Keep `var(--wallpaper-temperature-filter)` before saturation/contrast/blur, apply only `scale(var(--wallpaper-scale))`, and preserve pointer-events, opacity, and the existing z-index behavior.

- [ ] **Step 4: Run the focused renderer test and typecheck**

Run:

```bash
pnpm exec vitest run tests/renderer/appearance-settings.test.tsx
pnpm typecheck
```

Expected: default/effect assertions pass; TypeScript reports no errors.

### Task 3: Implement the vertical 16:9 slot list and contextual actions

**Files:**
- Modify: `src/renderer/components/AppearanceDialog.tsx:1-152`
- Modify: `src/renderer/styles/settings.css:281-366,471-483`

- [ ] **Step 1: Add the empty-slot placeholder and stable slot identity**

Import `Plus` from `lucide-react`, add `data-slot={slot}` to `.appearance-wallpaper-item`, and render the existing image for populated slots or this placeholder for empty slots:

```tsx
{assetName === null ? (
  <span aria-hidden="true" className="appearance-wallpaper-placeholder">
    <Plus size={20} />
  </span>
) : (
  <img alt={`壁纸 ${slot + 1}`} src={`dnf-asset://wallpaper/${assetName}`} />
)}
```

Render the delete action container only when `assetName !== null`, so an empty slot contains only its plus affordance.

- [ ] **Step 2: Make the slot container scroll without changing its width**

Keep `width: 180px` and `flex-basis: 180px` at the base breakpoint. Set the list to `height: 100%`, `min-height: 0`, `overflow-x: hidden`, and `overflow-y: auto`. Set each item to `width: 100%`, `aspect-ratio: 16 / 9`, `height: auto`, `min-height: 0`, and `flex: 0 0 auto`; retain the existing 6px gap and active border styling.

- [ ] **Step 3: Center plus placeholders and hide delete actions until interaction**

Add:

```css
.appearance-wallpaper-placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: var(--color-text-tertiary);
}

.appearance-wallpaper-actions {
  position: absolute;
  z-index: 2;
  top: 6px;
  right: 6px;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-fast) var(--easing-standard);
}

.appearance-wallpaper-item:hover .appearance-wallpaper-actions,
.appearance-wallpaper-item:focus-within .appearance-wallpaper-actions {
  opacity: 1;
  pointer-events: auto;
}
```

Use `object-fit: contain` so the 16:9 image slot does not crop imported wallpaper thumbnails, and add `overflow: hidden` to the item so the image and hover action stay inside the border.

- [ ] **Step 4: Run the focused renderer test**

Run:

```bash
pnpm exec vitest run tests/renderer/appearance-settings.test.tsx
```

Expected: plus, image, and slot-action assertions pass.

### Task 4: Validate the integrated wallpaper workflow

**Files:**
- Modify: `tests/e2e/appearance.e2e.ts` if selector or visual assertions need final alignment.

- [ ] **Step 1: Build the Electron application**

Run `pnpm build` and expect all main, preload, and renderer bundles to build successfully.

- [ ] **Step 2: Run the appearance E2E test**

Run `pnpm exec playwright test tests/e2e/appearance.e2e.ts`. Verify import activation, opacity `0.5`, temperature filter, X/Y background positioning, transparent backdrop, equal tab dimensions, 16:9 slot dimensions, hidden/hover-visible delete action, and vertical scrolling.

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
pnpm test
pnpm test:integration
pnpm exec biome check --formatter-enabled=false --linter-enabled=true --no-errors-on-unmatched src/core/state/schemas.ts src/renderer/workspace/useAppearance.ts src/renderer/components/AppearanceDialog.tsx src/renderer/styles/settings.css src/renderer/styles/toolbar.css tests/renderer/appearance-settings.test.tsx tests/e2e/appearance.e2e.ts
pnpm typecheck
git diff --check
```

Expected: all tests, focused lint, typecheck, and whitespace checks pass. A repository-wide formatter failure caused by pre-existing CRLF files is not fixed as part of this scoped change.

- [ ] **Step 4: Inspect the generated desktop screenshots and final Git status**

Confirm the slot list is visibly vertical and scrollable, empty slots show plus icons, populated slots use 16:9 thumbnails, and no unrelated files were staged. Report any pre-existing unstaged files separately from this implementation.

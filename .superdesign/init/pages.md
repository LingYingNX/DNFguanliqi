# Page Dependency Trees

## Main Workspace

Entry: `src/renderer/App.tsx`

- `src/renderer/components/WorkspaceApp.tsx`
  - `src/renderer/components/WindowTitleBar.tsx`
  - `src/renderer/components/CategorySidebar.tsx`
  - `src/renderer/components/ItemWorkspace.tsx`
  - `src/renderer/components/AppearanceDialog.tsx`
    - `src/renderer/components/Dialog.tsx`
    - `src/core/state/schemas.ts`
    - `src/shared/appearance-contracts.ts`
  - `src/renderer/components/SettingsDialog.tsx`
  - `src/renderer/components/primitives.tsx`
  - `src/renderer/workspace/useAppearance.ts`
  - `src/renderer/workspace/useWorkspace.ts`
- `src/renderer/styles/base.css`
  - `src/renderer/styles/tokens.css`
  - `src/renderer/styles/settings.css`
  - `src/renderer/styles/layout.css`
  - `src/renderer/styles/controls.css`

For the appearance dialog design, use `AppearanceDialog.tsx`, `Dialog.tsx`, `settings.css`, `tokens.css`, and `controls.css` as the lean visual context set.

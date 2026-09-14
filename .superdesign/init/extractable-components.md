# Extractable Components

## Dialog
- Source: `src/renderer/components/Dialog.tsx`
- Category: layout
- Description: Accessible modal shell used across settings workflows.
- Extractable props: title, hideHeader, closeOnBackdrop.
- Hardcoded: focus behavior and close icon treatment.

## AppearanceNavigation
- Source: `src/renderer/components/AppearanceDialog.tsx`
- Category: layout
- Description: Compact vertical navigation rail for appearance categories.
- Extractable props: activeTab.
- Hardcoded: icon size, button spacing, selected-state styling.

## CommandButton
- Source: `src/renderer/components/primitives.tsx`
- Category: basic
- Description: Shared icon-and-label command button.
- Extractable props: variant, loading, disabled.
- Hardcoded: CSS class naming and loading glyph.

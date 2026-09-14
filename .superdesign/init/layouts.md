# Shared Layouts

## `src/renderer/App.tsx`

Root renderer switch. It renders `WorkspaceApp` for the product and `PrimitiveShowcase` only when `?showcase=1` is present.

## `src/renderer/components/WorkspaceApp.tsx`

Main application shell. It composes the custom title bar, category sidebar, workspace content, settings dialog, and appearance dialog. Pass the full source file for whole-app designs.

## `src/renderer/components/WindowTitleBar.tsx`

Custom draggable title bar with product/author identity and Windows window controls. Pass the full source file when a draft includes the application frame.

## `src/renderer/components/Dialog.tsx`

Shared modal layout used by appearance settings. Pass the full source file for dialog designs.

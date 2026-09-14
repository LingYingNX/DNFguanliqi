# Shared Components

## `src/renderer/components/primitives.tsx`

Shared command buttons, badges, feedback panels, and toast primitives. Pass the full source file to design calls that use these controls.

## `src/renderer/components/Dialog.tsx`

Accessible modal shell with focus trapping, Escape handling, optional header, and close behavior. The appearance feature uses this shell directly; pass the full source file.

## `src/renderer/components/AppearanceDialog.tsx`

Existing appearance settings UI. It owns the left navigation and right theme/wallpaper panels. Pass the full source file as the visual source of truth.

The project uses source files directly as design context so generated drafts receive the exact current implementation rather than duplicated snapshots.

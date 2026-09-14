# DNF previews and appearance design

## Scope

Task 10 adds managed item previews, five wallpaper slots, persisted appearance controls, and a Halo settings dialog. It extends the existing typed Electron boundary and atomic state stores without exposing filesystem paths or Node APIs to the renderer.

## State ownership

- `data/settings.json` remains the application settings source and gains appearance values: theme, temperature, saturation, contrast, scale, opacity, blur, wallpaper position, category text color, and selected tint.
- `data/previews.json` stores preview bindings. Each binding owns a managed asset name and is either active at an item kind/path or recycled under a recycle entry ID. Scanner DTOs expose only a managed preview URL.
- `data/wallpapers.json` stores exactly five nullable slots and one nullable active slot index. Managed assets live under `data/wallpapers/`.
- Missing files use documented defaults. Malformed files return typed corruption errors and are never reset silently.

## Managed assets

Native pickers accept PNG, JPEG, WebP, BMP, and GIF. The main process validates the selected extension, generates a stable asset ID, and copies with exclusive creation into `data/previews/` or `data/wallpapers/`. Deletion only resolves names already parsed from the corresponding state file and never accepts a renderer path.

Renderer image sources use a dedicated custom protocol URL created by the main process. The URL contains only the managed asset kind and generated filename; protocol handling resolves and confines the final path to the matching data directory.

## Preview lifecycle

- Double-clicking only the preview region invokes `selectItemPreview` with item kind and relative path.
- Replacing a preview writes the new managed asset and state before removing the old managed asset.
- Move/rename changes the active binding path in the same application transaction as the library move.
- Recycle changes the binding from active path to recycle entry ID in the same transaction.
- Restore changes the recycled binding back to the restored path in the same transaction.
- A new item created at a recycled item's old path therefore has no preview binding.

## Wallpaper lifecycle

Slots are indices 0 through 4. Import or replace copies a new managed asset, commits state, then removes the displaced managed asset. Delete commits a null slot and clears the active index when necessary before removing the managed file. Activating an empty slot is rejected.

## Appearance rendering

The renderer loads settings once and applies them through CSS custom properties on the app shell. Wallpaper temperature, saturation, contrast, scale, opacity, blur, and position are rendered by a fixed background layer behind the workspace with a contrast overlay. Theme changes switch a root data attribute. Category text and selection tint update dedicated variables.

## Settings UI

The toolbar receives a Lucide Settings icon button with tooltip and ARIA label. The dialog is one scrollable Halo panel with three unframed sections:

1. Five wallpaper slots with thumbnail, import/replace, activate, and delete controls.
2. A segmented theme control plus seven labeled numeric sliders.
3. Category text and selection color inputs with visible swatches.

The dialog remains within 1280x720 using fixed header/actions and a scrolling body. It contains no nested cards and no instructional feature copy.

## Error handling

Every IPC input is Zod parsed. Expected state, conflict, picker cancellation, and managed-asset errors return typed API results. A failed copy or state write preserves the previous state and source file. Cleanup failure is surfaced rather than reported as success.

## Verification

- Integration tests cover defaults, corruption, exclusive managed copy, replacement, deletion, and source preservation.
- Lifecycle tests cover preview bindings through move, recycle, and restore.
- Renderer tests cover dialog controls, visible appearance updates, five slots, and preview double-click for patches and groups.
- Electron E2E imports generated images, verifies real preview/wallpaper rendering, and captures 1280x720, 1440x900, and 1920x1080 without document overflow.

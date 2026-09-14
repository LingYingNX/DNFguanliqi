# DNF Patch Manager Design System

## Product Context

DNF Patch Manager is a Windows desktop operations tool for organizing, previewing, and installing local patch assets. Interfaces should remain compact, quiet, dark, and optimized for repeated use.

## Visual Language

- Use the existing near-black canvas and graphite surfaces from `tokens.css`.
- Use cool indigo `#5b6bff` only for active state, focus, and primary emphasis.
- Use Segoe UI Variable / Segoe UI by default; the new font setting previews fonts installed on Windows.
- Keep controls dense: 30-36 px heights, 4-8 px radii, 1 px borders, restrained shadows.
- Use Lucide icons at 14-16 px and preserve the current icon-plus-label navigation pattern.
- No gradients, oversized type, decorative cards, or marketing composition.

## Appearance Dialog

- Preserve the current fixed modal dimensions, two-column structure, navigation width, spacing, close control, and wallpaper panel.
- Add `字体外观` directly below `静态壁纸` with a typography icon matching existing navigation items.
- Its right panel contains a Windows-installed-font selector and a font color control, with an immediate preview that feels native to the existing settings UI.
- Long font lists must remain usable through a native/select-like searchable or scrollable control without resizing the dialog.
- The selected font and color apply immediately to the application and persist with appearance settings.

## Interaction

- Hover and focus states use existing border/focus tokens.
- Changes preview immediately; persistence errors use the existing notice system.
- Controls remain keyboard accessible and expose clear labels.

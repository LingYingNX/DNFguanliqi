# Theme

## Compact Token Summary

- Framework: React 19 + Electron Vite; custom components; vanilla global CSS.
- Font: `"Segoe UI Variable", "Segoe UI", system-ui, sans-serif`.
- Canvas/surfaces: `#0a0b0f`, `#14151c`, `#1e2029`.
- Borders: `#2a2d38`, strong `#3a3d4a`.
- Text: primary `#f2f4f8`, secondary `#9aa0ae`, tertiary `#5c6170`.
- Primary: `#5b6bff`; hover `#7886ff`; pressed `#4a59e6`; focus `rgba(91, 107, 255, .35)`.
- Semantic: success `#2be08c`, warning `#f5d547`, info `#3dd7e5`, error `#ff3a5c`.
- Spacing: 4, 8, 12, 16, 24, 32 px tokens.
- Radius: compact controls use 4-6 px; panels/dialogs use 8 px.
- Appearance dialog: fixed dark two-column modal, 124 px navigation rail, 1 px divider, dense controls.

## Raw Sources

Pass these complete files to SuperDesign because they are under the 900-line threshold:

- `src/renderer/styles/tokens.css`
- `src/renderer/styles/base.css`
- `src/renderer/styles/settings.css`
- `src/renderer/styles/controls.css`

There is no Tailwind configuration or theme provider.

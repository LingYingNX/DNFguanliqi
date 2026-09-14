---
version: alpha
name: Halo
description: A modern, minimal, and scalable dark design system that treats the interface as deep-space substrate and information as the source of light.
theme: dark
colors:
  background: "#0A0B0F"
  surface: "#14151C"
  elevated: "#1E2029"
  border: "#2A2D38"
  border-strong: "#3A3D4A"
  on-surface: "#F2F4F8"
  on-surface-muted: "#9AA0AE"
  on-surface-faint: "#5C6170"
  primary: "#5B6BFF"
  primary-hover: "#7886FF"
  primary-pressed: "#4A59E6"
  secondary: "#3DD7E5"
  tertiary: "#F5D547"
  success: "#2BE08C"
  warning: "#F5D547"
  info: "#3DD7E5"
  error: "#FF3A5C"
  focus: "rgba(91, 107, 255, 0.35)"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "4.5rem"
    fontWeight: 600
    letterSpacing: "-0.03em"
    lineHeight: 1.04
  headline-lg:
    fontFamily: "Inter, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
    lineHeight: 1.12
  headline-md:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    letterSpacing: "-0.015em"
    lineHeight: 1.2
  title-md:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
    lineHeight: 1.3
  body-md:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    letterSpacing: "-0.005em"
    lineHeight: 1.55
  body-sm:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    letterSpacing: "0"
    lineHeight: 1.5
  label-sm:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.08em"
    lineHeight: 1.2
    textTransform: "uppercase"
  mono-sm:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    letterSpacing: "0"
    lineHeight: 1.4
  metric:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "2.5rem"
    fontWeight: 600
    letterSpacing: "-0.02em"
    lineHeight: 1
rounded:
  none: "0px"
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  full: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  xxl: "64px"
  gutter: "24px"
border:
  width: "1px"
  width-thick: "1.5px"
elevation:
  sm: "0 1px 0 rgba(255,255,255,0.02) inset, 0 1px 2px rgba(0,0,0,0.4)"
  md: "0 8px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.03) inset"
  lg: "0 24px 60px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset"
  focus: "0 0 0 3px rgba(91, 107, 255, 0.35)"
motion:
  duration-fast: "120ms"
  duration-base: "150ms"
  duration-slow: "240ms"
  easing-standard: "cubic-bezier(0.2, 0.6, 0.2, 1)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0px 18px"
    typography: "{typography.body-sm}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#FFFFFF"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0px 18px"
    border: "1px solid {colors.border-strong}"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-muted}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0px 18px"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0px 18px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0px 14px"
    border: "1px solid {colors.border}"
  input-field-focus:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.primary}"
    shadow: "{elevation.focus}"
  input-field-error:
    border: "1px solid {colors.error}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
    border: "1px solid {colors.border}"
  card-elevated:
    backgroundColor: "{colors.elevated}"
    rounded: "{rounded.lg}"
    padding: "24px"
    border: "1px solid {colors.border-strong}"
    shadow: "{elevation.md}"
  checkbox:
    backgroundColor: "{colors.surface}"
    rounded: "6px"
    size: "18px"
    border: "1px solid {colors.border-strong}"
  checkbox-checked:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    border: "1px solid {colors.primary}"
  radio:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: "18px"
    border: "1px solid {colors.border-strong}"
  radio-checked:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    border: "1px solid {colors.primary}"
  switch-track:
    backgroundColor: "{colors.elevated}"
    rounded: "{rounded.full}"
    width: "36px"
    height: "20px"
    border: "1px solid {colors.border-strong}"
  switch-track-on:
    backgroundColor: "{colors.primary}"
    border: "1px solid {colors.primary}"
  tabs-container:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "4px"
    border: "1px solid {colors.border}"
  tabs-active:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
    height: "32px"
    padding: "0px 14px"
    border: "1px solid {colors.primary}"
  tabs-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-muted}"
    rounded: "{rounded.full}"
    height: "32px"
    padding: "0px 14px"
  chip:
    backgroundColor: "rgba(91, 107, 255, 0.12)"
    textColor: "{colors.primary-hover}"
    rounded: "{rounded.full}"
    height: "24px"
    padding: "0px 10px"
    typography: "{typography.mono-sm}"
  stat-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
    border: "1px solid {colors.border}"
  stat-tile-accent:
    backgroundColor: "{colors.primary}"
    height: "2px"
---

## Overview

Halo is a dark, architectural design system built around the idea that the interface should fade and the data should glow. Surfaces stack in three quiet charcoal tiers, hairline 1px borders draw the geometry, and a single electric indigo carries every action. Saturated signal colors — lime, amber, cyan, magenta — are reserved for status, trends, and points of focus, so the screen reads as a calm dashboard with bright, intentional flares of information.

The system is framework-agnostic. It is delivered as plain CSS custom properties and reusable class selectors, paired with semantic HTML elements (`<button>`, `<input>`, `<label>`, `<section>`, `<article>`). It is designed for product surfaces — dashboards, console screens, settings panels, marketing pages — where density and clarity matter more than ornament.

## Colors

Halo's palette is intentionally tight. The neutral spine is a single near-black canvas split into three surface tiers, separated by hairline borders rather than shadows. Color is then introduced as light: one brand indigo for actions and focus, and four signal hues that each map to a single, predictable meaning.

| Token | Hex | Role |
| --- | --- | --- |
| `background` | `#0A0B0F` | Page canvas, viewport, and outer layout |
| `surface` | `#14151C` | Cards, panels, inputs, and component fills |
| `elevated` | `#1E2029` | Modals, popovers, active tabs, hovered controls |
| `border` | `#2A2D38` | Hairline dividers and default component outlines |
| `border-strong` | `#3A3D4A` | Inputs, secondary buttons, emphasised dividers |
| `on-surface` | `#F2F4F8` | Headlines, body, and primary foreground |
| `on-surface-muted` | `#9AA0AE` | Secondary text, labels, inactive controls |
| `on-surface-faint` | `#5C6170` | Helper text, placeholders, captions |
| `primary` | `#5B6BFF` | Primary action, focus ring base, brand accent |
| `success` | `#2BE08C` | Positive metrics, confirmation, "up" trends |
| `warning` | `#F5D547` | Caution, attention, editorial highlight |
| `info` | `#3DD7E5` | Information, data accent, decorative |
| `error` | `#FF3A5C` | Destructive actions, "down" trends, critical alerts |

Accessibility: primary text on `background` meets WCAG AA at all body sizes. Use `on-surface-muted` for supporting text only; never for primary copy below 14px. Signal colors are always paired with an icon or label — never used as the only signal.

## Typography

Halo uses a modern grotesque typographic system with a tabular monospace companion for numbers, hex tokens, and dense data. Inter is the primary face for UI, headlines, and body; JetBrains Mono carries every metric, code sample, and token value so numerics align cleanly in tables and stat tiles.

| Level | Family | Size / Weight / Tracking |
| --- | --- | --- |
| `display` | Inter | clamp(2.75rem, 6vw, 4.5rem) / 600 / -0.03em |
| `headline-lg` | Inter | 2.25rem / 600 / -0.02em |
| `headline-md` | Inter | 1.5rem / 600 / -0.015em |
| `title-md` | Inter | 1.125rem / 600 / -0.01em |
| `body-md` | Inter | 0.9375rem / 400 / -0.005em |
| `body-sm` | Inter | 0.8125rem / 400 / 0 |
| `label-sm` | Inter | 0.75rem / 500 / 0.08em UPPERCASE |
| `mono-sm` | JetBrains Mono | 0.8125rem / 500 / 0 |
| `metric` | JetBrains Mono | 2.5rem / 600 / -0.02em |

Display sizes carry tight negative tracking and are used sparingly, typically once per page for hero headlines. Eyebrow labels use `label-sm` with wide tracking to act as quiet section dividers. Numerics always use `mono-sm` or `metric` to preserve column alignment.

## Layout

The layout follows a 4px base spacing scale. Containers cap at 1200px with a responsive horizontal padding via `clamp(20px, 4vw, 48px)`. Internal density is medium: components allow generous breathing room, with 24px section gutters and 16px inline gutters as the default.

- Spacing: `xs 4px`, `sm 8px`, `md 16px`, `lg 24px`, `xl 40px`, `xxl 64px`.
- Container: `max-width: 1200px` with responsive side padding.
- Grids: 2, 3, and 4 column responsive grids collapse to single column below 720px.
- Section rhythm: every major section is separated by 64–80px of vertical space; cards inside a section by 24px.
- Top navigation is a 64px bar with a hairline bottom border; the brand mark sits on the left and a control cluster sits on the right.

## Elevation & Depth

Depth in Halo is created by stacking material, not by blurring shadows. Three surface tiers (background → surface → elevated) communicate hierarchy, and 1px borders carry the geometry that shadow would carry in a light system. A single ambient shadow is reserved for floating elevated surfaces such as modals and popovers; focus and hover use saturated color, not blur.

| Token | Value | Use |
| --- | --- | --- |
| `elevation.sm` | inset + 1px shadow | Pressed buttons, subtle inner depth |
| `elevation.md` | 0 8px 24px black 45% | Elevated cards, popovers |
| `elevation.lg` | 0 24px 60px black 55% | Modals, command palettes, drawers |
| `elevation.focus` | 0 0 0 3px indigo 35% | All focus rings |

Focus is the only state allowed to glow. Hover lifts a control by one tier (e.g. `surface → elevated`) rather than adding a shadow.

## Shapes

The shape language is soft, architectural rectangle. Corners are never sharp; ornament is achieved with hairline borders and color, never chrome or gradients.

- `none` 0px — used only for full-bleed dividers.
- `sm` 6px — checkboxes and small inline pills.
- `md` 10px — buttons, inputs, selects, segmented controls.
- `lg` 16px — cards, stat tiles, panels.
- `xl` 24px — hero sections, large feature surfaces.
- `full` 999px — tabs container, switch tracks, dot badges, signal chips.

Border weight is uniformly `1px`. A `1.5px` thick variant is reserved for emphasized strokes on hero cards or callout banners.

## Components

### Button
Three variants and three sizes share one anatomy: 10px radius, single-line label, optional leading or trailing icon. Primary is a solid indigo fill with a faint top inset highlight. Secondary is a surface tile with a 1px strong border. Tertiary is text-only with a surface hover tint. Danger swaps primary indigo for the magenta error token. Sizes are 32px (sm), 40px (default), and 48px (lg).

### Input and form field
Inputs sit on the `surface` tier with a 1px `border`. A `label-sm` uppercase label sits above with widened tracking. Placeholder uses `on-surface-faint`. Focus state switches the border to `primary` and adds the standard 3px focus ring. Optional leading icon and helper text are supported. Error state replaces the border with `error` and the focus ring with a soft `error` glow. Selects and textareas inherit the same anatomy.

### Card
Cards use 16px radius, 1px border, and 20–24px internal padding. Variants include base card, elevated card (uses `elevated` surface and `md` shadow), media card (top media block with hairline bottom border), and accent card (a colored 2px top hairline drawn from any signal token via `data-accent`).

### Checkbox and radio
18px square with 6px radius (checkboxes) or full radius (radio). Default state is `surface` fill with a strong border; checked fills with `primary` and shows a white check glyph. Radio adds an inner 8px white dot. Both share the standard 3px focus ring.

### Tabs (segmented control)
A pill-style container on the `surface` tier with 4px internal padding and full radius. Active tab is an `elevated` tile with a 1px `primary` border. Inactive tabs are transparent with `on-surface-muted` text; hover lifts to elevated.

### Stat Tile (signature)
The system's hero pattern. A compact metric tile pairs a `label-sm` eyebrow, a large monospaced numeric value, a trend chip (lime for positive, magenta for negative) with a directional arrow glyph, and a 32px-tall inline sparkline rendered as a polyline. The tile lives on `surface`, uses 16px radius and a hairline border, and carries a 2px colored top hairline that picks up the relevant signal tone. Three sizes (`sm`, `md`, `lg`) cover dashboard, list, and hero contexts.

### Icons
The system uses Lucide (https://lucide.dev, ISC license) as its single icon library. Icons are rendered at a 1.5–1.75px stroke weight to match the hairline border language and inherit `currentColor` so they tint with their containing component. Do not mix icon libraries or invent custom paths.

## Do's and Don'ts

**Do**
- Use the three surface tiers in order: `background` for page, `surface` for components, `elevated` for floating or active states.
- Reserve `primary` indigo for action and focus; never use it for purely decorative fills.
- Use `mono-sm` or `metric` for every number that needs to align in a column.
- Pair signal colors with an icon or text label, never color alone.
- Keep one icon library — Lucide — and one stroke weight across the entire surface.

**Don't**
- Don't introduce drop shadows on flat components; depth comes from tier and border.
- Don't combine more than one signal color per stat tile or chip.
- Don't lower body text below 13px or set primary text in `on-surface-muted`.
- Don't sharpen corners to 0; the system has no square components.
- Don't gradient-fill buttons or surfaces; brand color is delivered as a single, solid tone.

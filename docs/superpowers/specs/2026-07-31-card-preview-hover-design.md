# Card Preview Hover Design

## Scope

Add a hover preview affordance to patch and group cards. The existing card selection,
double-click image picker, enable switch, and list view remain available.

## Interaction

- A card gets a blue border while the pointer is over it.
- A selected card keeps a yellow border, including while hovered.
- A small circular preview affordance appears at the card's upper-left corner while
  the card is hovered.
- Hovering the affordance shows the card preview at two times the rendered preview
  width. The zoomed image keeps the source image's aspect ratio without cropping or
  letterboxing, fades and scales in from the upper-left corner, and must not change
  card layout or push nearby cards.
- Cards without a matching preview keep the existing double-click selection hint and
  do not show a zoomed image.

## Preview Files

Selecting an image for a patch copies it beside the NPK file. The target name uses the
patch basename and the selected image extension, for example `A.npk` and `A.png`.
Selecting an image for a group copies it inside the group directory using the group
name as the basename.

The scanner recognizes only supported image files in the same directory whose
case-insensitive basename matches the patch or group name. Selecting a replacement
must replace the existing matching preview files without leaving multiple candidates.
Moving, renaming, recycling, and restoring items naturally move these files with the
item. Existing managed preview state and assets remain stored but do not override the
same-name file rule for card display.

## Implementation

- Add a validated `dnf-library` image protocol restricted to the configured library
  root and safe relative paths.
- Extend scanned patch and group DTOs with the matching preview relative path and
  decorate cards with a library URL only when that path exists.
- Update preview selection to copy the chosen image to the item directory with the
  required basename and extension.
- Keep the existing IPC entry point and double-click flow; change only its persistence
  target and returned preview URL behavior.
- Add renderer and Electron coverage for hover/selected borders, the zoom overlay,
  same-name discovery, mismatched-name hiding, patch/group copy locations, and file
  replacement.

## Compatibility

The existing `previews.json` state schema and managed assets remain readable for
recovery and older data. New card display is determined by same-directory matching
files, so stale managed bindings cannot display an image with a different name.

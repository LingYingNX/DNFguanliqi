## Why

The real library contains a valid group with two NPK files and a matching preview image, but dissolving the group rejects the preview image and leaves the group unchanged. Recursive category scanning also reports zero for a parent whose descendants contain patches and only exposes descendant regular patches, so descendant group cards are missing from the workspace.

This change aligns the development application with the existing on-disk library contract. It does not change the portable packaging workflow.

## What Changes

- Allow a group to be dissolved when it contains its recognized matching preview image, while preserving the existing protection against unrelated or unsupported group contents.
- Return a specific user-facing error for invalid group contents instead of the generic fallback message.
- In recursive category scans, collect descendant group cards as well as descendant regular NPK cards.
- In recursive category scans, aggregate NPK counts from descendant categories and groups so the selected parent category reports the visible patch count.
- Keep direct category scans limited to the current category and its direct groups.
- Add regression coverage for nested groups, recursive counts, matching previews, and the dissolve workflow.

## Capabilities

### New Capabilities

- `library-recursive-group-behavior`: Recursive category views and group lifecycle operations must reflect valid nested library contents, including groups and matching preview images.

### Modified Capabilities

None.

## Impact

- Scanner and group lifecycle logic under `src/core/library/`.
- IPC error translation under `src/main/ipc/`.
- Recursive workspace item construction under `src/renderer/workspace/`.
- Integration and renderer regression tests.
- No new dependency, IPC request shape, or client packaging change.

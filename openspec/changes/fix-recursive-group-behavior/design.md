## Context

The scanner currently builds direct groups and direct patch files in `CategorySnapshot`, then uses a separate recursive helper that only returns ordinary descendant patches. `CategorySnapshot.patchCount` therefore remains direct-only even when recursive scope is requested, and descendant groups never reach the renderer. The group dissolve command currently validates every non-marker entry as an NPK, although the scanner already recognizes a matching image as a valid group preview.

The change must preserve direct-scope behavior, the existing relative-path safety boundary, and the transactional file-operation model. The launcher remains a development launcher; portable packaging is outside this change.

## Goals / Non-Goals

**Goals:**

- Make recursive scans return both descendant patch cards and descendant group cards.
- Make recursive patch counts include each descendant NPK exactly once while keeping direct counts direct-only.
- Allow dissolution of groups with their recognized matching preview image without losing that image.
- Keep invalid extra group contents protected by a preflight failure and expose a useful API error message.
- Prevent the sidebar all count from double-counting data already present in a recursive snapshot.
- Add red regression tests at the scanner, file-transaction, and renderer seams.

**Non-Goals:**

- No change to the IPC request or response shape.
- No new persistent metadata format or migration.
- No support for arbitrary files inside groups.
- No client packaging, portable executable generation, or launcher redesign.

## Decisions

### Reuse the existing group and patch DTOs

Recursive collection will return the existing `PatchItem` and `GroupItem` values with their full relative paths. `ChildCategory` will not gain a new group-count field because the workspace needs the actual group cards, not another summary-only representation. This keeps the IPC schema stable.

An alternative would be to add only aggregate counts to `ChildCategory` and perform a second scan when a group is opened. That would keep the snapshot smaller but cannot render the requested descendant group cards and would make operations depend on hidden rescans.

### Use one recursive item collector

The scanner will walk each descendant category, classify its direct files and marker-bearing directories, and return descendant patches, descendant groups, and the descendant NPK total. The root scan will merge these results only when `includeDescendants` is true. Direct groups remain in the existing direct result, so no item is visited twice.

The recursive snapshot's `patchCount` will be the current direct NPK count plus the recursive collector's NPK total. Group card count remains separate in `groups.length`. The sidebar will use the recursive snapshot totals directly and will use the category-tree totals only when its root snapshot was scanned in direct mode.

### Treat only the recognized matching preview as group content

During dissolve preflight, the marker display name will be passed through the existing preview matcher. The matching preview is the only non-NPK file allowed in the group. It will be moved to the parent with its original filename in the same transaction as the NPK files. Any unmatched image, directory, or other file continues to return `GROUP_CONTENT_NOT_PATCHES` before any file step runs.

An alternative would be to delete the preview when the group is dissolved because it no longer belongs to a group. Moving it preserves user data and follows the repository's existing no-destructive-overwrite policy. A target conflict for the preview will fail the complete operation before modification.

### Add explicit API translations for group validation errors

The IPC error mapper will provide messages for group-not-found and invalid-group-content errors. The renderer already consumes `error.message`, so no new UI event or IPC field is required.

## Risks / Trade-offs

- [Risk] A matching preview moved to the parent may no longer be associated with a patch after dissolution. -> Mitigation: preserve it without overwriting; the operation remains lossless and the file is available for future use.
- [Risk] Recursive scans read more directories and files than direct scans. -> Mitigation: reuse the existing single scan request and only recurse when the user-selected scope requires it.
- [Risk] Existing tests encode the old exclusion of descendant groups and preview rejection. -> Mitigation: replace those assertions with the approved scenarios and retain an explicit unmatched-extra-file rejection test.
- [Risk] A stale `out` build can make the launcher appear unchanged. -> Mitigation: run `pnpm build` before the BAT smoke test, while avoiding `electron-builder` and portable output.

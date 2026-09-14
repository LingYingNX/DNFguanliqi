## Purpose

This capability keeps category counts, recursive workspace cards, and group dissolution consistent with valid files and metadata already present in the local patch library.

## ADDED Requirements

### Requirement: Recursive category scope exposes descendant patches and groups

When recursive scope is enabled for a category, the system MUST expose every ordinary `.NPK` patch and every valid group in that category's descendant directories. Each exposed item MUST retain its library-relative path so operations target the original nested item. When recursive scope is disabled, the system MUST expose only the current category's direct patches and direct groups.

#### Scenario: Recursive scope includes a nested group

- **WHEN** a category contains a child category with a valid group marker and the recursive scope is enabled
- **THEN** the workspace includes one group card for that nested group and the card path points to the nested group directory

#### Scenario: Direct scope excludes a nested group

- **WHEN** the same category is scanned with recursive scope disabled
- **THEN** the nested group is absent from the workspace items and remains represented only in the category tree

#### Scenario: Nested group operations use its real path

- **WHEN** a user dissolves, moves, enters, or otherwise operates on a group card discovered through recursive scope
- **THEN** the request uses the group's full library-relative path rather than the selected category path

### Requirement: Recursive counts include descendant patch files exactly once

The system MUST count `.NPK` files in the current category, direct groups, descendant categories, and descendant groups when recursive scope is enabled. Preview images, marker files, and non-patch files MUST NOT affect patch counts. Direct scope counts MUST remain limited to the current category and its direct groups.

#### Scenario: Parent count includes descendant ordinary patches and group patches

- **WHEN** a category has one ordinary descendant `.NPK` and one descendant group containing two `.NPK` files, and recursive scope is enabled
- **THEN** the selected category count is three

#### Scenario: Parent count ignores previews and metadata

- **WHEN** the same library contains preview images and `.dnf-group.json` files alongside those patches
- **THEN** the count remains three

#### Scenario: All view does not double-count recursive data

- **WHEN** the all-library snapshot already contains recursively collected patches and groups
- **THEN** the sidebar all count does not add the same descendant patch counts a second time

### Requirement: A valid group with its matching preview can be dissolved

The system MUST allow dissolution of a valid group containing its marker, one or more `.NPK` files, and at most the preview image whose base name matches the group's display name. Dissolution MUST move the group's patch files and recognized matching preview to the parent category, remove the marker, and remove the now-empty group directory as one transactional operation. Unrelated or unsupported extra files MUST continue to fail without modifying the group.

#### Scenario: Dissolve the real group with a matching preview

- **WHEN** a group contains `.dnf-group.json`, two `.NPK` files, and `1.jpg`, while the marker display name is `1`
- **THEN** both `.NPK` files and `1.jpg` are moved to the parent category, the group marker and directory are removed, and the operation reports success

#### Scenario: Reject an unrelated extra file

- **WHEN** a valid group also contains an image whose base name does not match the group display name or another unsupported file
- **THEN** dissolution reports an invalid group-content error and leaves every group file and the marker unchanged

#### Scenario: Report a useful invalid-content error

- **WHEN** dissolution is rejected because of invalid group contents
- **THEN** the renderer receives a specific user-facing message instead of the generic fallback message

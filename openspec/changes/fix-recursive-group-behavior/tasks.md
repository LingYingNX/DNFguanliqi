## 1. Regression Tests

- [x] 1.1 Extend the scanner integration fixture to cover a descendant group with two NPK files and a matching preview, and assert direct versus recursive groups, patches, and patch counts.
- [x] 1.2 Replace the old dissolve-preview rejection case with a matching-preview success case, and retain a no-modification failure case for an unmatched extra file.
- [x] 1.3 Add renderer coverage that enables recursive scope, shows a nested group card, preserves its full relative path in the dissolve request, and keeps the all count from double-counting recursive data.
- [x] 1.4 Add API error translation coverage for invalid group contents and group-not-found responses.

## 2. Scanner And Sidebar Counts

- [x] 2.1 Implement a recursive library item collector that returns descendant patch cards, valid group cards, and descendant NPK totals without changing direct-scope results.
- [x] 2.2 Merge recursive groups and patches into `CategorySnapshot` only when recursive scope is enabled, and aggregate the recursive patch count exactly once.
- [x] 2.3 Update the sidebar all-count calculation to distinguish direct root snapshots from recursive snapshots and avoid double-counting descendant data.

## 3. Group Dissolution

- [x] 3.1 Update dissolve preflight to allow only the matching group preview alongside NPK files, move that preview transactionally to the parent, and preflight preview target conflicts.
- [x] 3.2 Add explicit IPC messages for invalid group contents and missing groups so failed dissolution reports a useful reason.

## 4. Verification

- [x] 4.1 Run the focused integration and renderer regression tests, then run typecheck and lint.
- [x] 4.2 Run `pnpm build` to refresh development output and launch `启动DNF补丁管理器.bat --check`; confirm no portable packaging command is used.
- [x] 4.3 Inspect the final diff and OpenSpec status, and report modified files, tests, launcher verification, and remaining risks.

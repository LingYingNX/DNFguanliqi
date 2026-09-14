# Virtual Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace physical patch-group directories with portable application-state groups whose members remain as NPK files in one category.

**Architecture:** Add a `groups.json` repository in the existing portable `data` root. The scanner merges virtual groups with NPK files, while installation, preview, move, recycle, and renderer navigation resolve groups by UUID instead of a synthetic filesystem path. A one-time transaction migrates legacy marker directories before normal scanning.

**Tech Stack:** TypeScript, Electron main/preload IPC, Zod, Node `fs/promises`, existing atomic JSON stores and file transactions, React, Vitest, Playwright.

---

## File Map

- Create: `src/core/groups/group-state.ts` - Zod schema, atomic store, normalization, and group repository.
- Create: `src/core/groups/group-service.ts` - create, dissolve, validate, and member-change plans.
- Create: `src/core/groups/legacy-group-migration.ts` - transactional conversion of marker directories.
- Create: `tests/integration/group-service.test.ts` - virtual group lifecycle and member invariants.
- Create: `tests/integration/legacy-group-migration.test.ts` - successful and rolled-back old-group migration.
- Modify: `src/core/state/schemas.ts` - UUID-based active group preview binding.
- Modify: `src/core/library/scanner.ts` and `src/shared/library-dto.ts` - compose category and group snapshots from group state.
- Modify: `src/core/application/library-lifecycle-service.ts`, `src/core/install/*`, and `src/core/recycle/*` - resolve group member patches from the repository.
- Modify: `src/main/ipc/register-ipc.ts`, `src/preload/preload.ts`, and `src/shared/ipc-contracts.ts` - group-ID IPC operations and group scan endpoint.
- Modify: `src/renderer/workspace/*` and `src/renderer/components/WorkspaceApp.tsx` - group-ID navigation and operations.
- Delete after migration support is covered: `src/core/library/dissolve-group.ts`; remove marker-dependent group branches from `library-commands.ts`, `move-library-item.ts`, `move-library-items.ts`, `scanner.ts`, `install-sources.ts`, and category commands.

### Task 1: Add Persistent Virtual Group State

**Files:**
- Create: `src/core/groups/group-state.ts`
- Modify: `src/core/state/schemas.ts`
- Test: `tests/integration/group-service.test.ts`

- [ ] **Step 1: Write failing repository tests**

```ts
it("persists a same-category virtual group without moving its NPK files", async () => {
  const result = await groups.create({
    categoryRelativePath: "鬼剑士女",
    memberRelativePaths: ["鬼剑士女\\a.npk", "鬼剑士女\\b.npk"],
    name: "套装",
  });
  expect(result).toMatchObject({ ok: true, value: { categoryRelativePath: "鬼剑士女" } });
  expect(await readFile(join(category, "a.npk"), "utf8")).toBe("a");
  expect(await readFile(join(category, "b.npk"), "utf8")).toBe("b");
});

it("rejects a member already owned by another group", async () => {
  await createGroupWith(["鬼剑士女\\a.npk", "鬼剑士女\\b.npk"]);
  await expect(groups.create({
    categoryRelativePath: "鬼剑士女",
    memberRelativePaths: ["鬼剑士女\\a.npk", "鬼剑士女\\c.npk"],
    name: "第二组",
  })).resolves.toEqual({ ok: false, error: { code: "GROUP_MEMBER_ASSIGNED", relativePath: "鬼剑士女\\a.npk" } });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/group-service.test.ts`

Expected: FAIL because `src/core/groups/group-state.ts` does not exist.

- [ ] **Step 3: Implement state schema and repository**

```ts
export const VirtualGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  categoryRelativePath: z.string().min(0),
  memberRelativePaths: z.array(z.string().min(1)).min(1),
  createdAt: z.string().datetime(),
});

export const VirtualGroupsStateSchema = z.object({
  formatVersion: z.literal(1),
  groups: z.array(VirtualGroupSchema),
}).superRefine((state, ctx) => {
  const members = new Set<string>();
  for (const group of state.groups) {
    for (const path of group.memberRelativePaths) {
      const key = path.replaceAll("/", "\\").toLocaleLowerCase();
      if (members.has(key)) ctx.addIssue({ code: "custom", message: "duplicate group member" });
      members.add(key);
    }
  }
});

export function createVirtualGroupsStore(file: string): AtomicJsonStore<VirtualGroupsState> {
  return createAtomicJsonStore(file, VirtualGroupsStateSchema);
}
```

The repository must initialize missing state as `{ formatVersion: 1, groups: [] }`, normalize separators before comparisons, validate every selected member is an `.npk` immediately under `categoryRelativePath`, and write changes with the existing atomic JSON store.

- [ ] **Step 4: Run the focused test and format check**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/group-service.test.ts`

Expected: PASS.

Run: `rtk pnpm exec biome check src/core/groups/group-state.ts src/core/groups/group-service.ts tests/integration/group-service.test.ts`

Expected: exit code 0.

### Task 2: Implement Virtual Group Commands and Membership Changes

**Files:**
- Create: `src/core/groups/group-service.ts`
- Modify: `src/core/library/library-commands.ts`
- Modify: `src/core/library/move-library-item.ts`
- Modify: `src/core/library/move-library-items.ts`
- Test: `tests/integration/group-service.test.ts`
- Test: `tests/integration/move-library-item.test.ts`
- Test: `tests/integration/move-library-items.test.ts`

- [ ] **Step 1: Add failing lifecycle tests**

```ts
it("dissolves a virtual group without moving member files", async () => {
  const group = await createGroupWith(["分类A\\a.npk", "分类A\\b.npk"]);
  expect(await groups.dissolve(group.id)).toEqual({ ok: true, value: { id: group.id } });
  await expect(access(join(categoryA, "a.npk"))).resolves.toBeUndefined();
  expect((await groups.list()).value.groups).toEqual([]);
});

it("removes a patch from its group when it moves to another category", async () => {
  const group = await createGroupWith(["分类A\\a.npk", "分类A\\b.npk"]);
  await lifecycle.move({ kind: "patch", sourceRelativePath: "分类A\\a.npk", targetDirectoryRelativePath: "分类B" });
  expect((await groups.get(group.id)).value.memberRelativePaths).toEqual(["分类A\\b.npk"]);
});
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/group-service.test.ts tests/integration/move-library-item.test.ts tests/integration/move-library-items.test.ts`

Expected: FAIL because group commands still create marker folders and patch moves do not update group state.

- [ ] **Step 3: Replace physical group creation and dissolution**

```ts
export type CreateVirtualGroupRequest = {
  readonly categoryRelativePath: string;
  readonly memberRelativePaths: readonly string[];
  readonly name: string;
};

export type VirtualGroupService = {
  create(request: CreateVirtualGroupRequest): Promise<Result<VirtualGroup, VirtualGroupError>>;
  dissolve(groupId: string): Promise<Result<{ readonly id: string }, VirtualGroupError>>;
  removeMembers(paths: readonly string[]): Promise<Result<void, VirtualGroupError>>;
  relocateGroup(groupId: string, targetCategoryRelativePath: string): Promise<Result<RelocateGroupPlan, VirtualGroupError>>;
};
```

`createGroup` must delegate to `VirtualGroupService.create` and return `{ id, categoryRelativePath }`; it must contain no `mkdir`, marker write, or NPK move. `dissolveGroup` must accept `groupId` and remove only the group record. Patch move plans must append a compensatable group-state update that removes a member when its target category differs. Group move plans must resolve all members, preflight every target, move every NPK using the existing file transaction, then atomically update all member paths and `categoryRelativePath`.

- [ ] **Step 4: Remove old physical command tests and add group move assertions**

Replace tests that assert `.dnf-group.json` or a group directory exists with assertions that the NPK paths are unchanged and `groups.json` contains the group. Add a target-collision test proving group move compensates already moved NPK files and leaves the original state unchanged.

- [ ] **Step 5: Run focused command and move tests**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/group-service.test.ts tests/integration/library-commands.test.ts tests/integration/move-library-item.test.ts tests/integration/move-library-items.test.ts`

Expected: PASS.

### Task 3: Scan Virtual Groups and Expose Group Snapshots

**Files:**
- Modify: `src/shared/library-dto.ts`
- Modify: `src/core/library/scanner.ts`
- Modify: `src/shared/ipc-contracts.ts`
- Test: `tests/integration/scanner.test.ts`
- Test: `tests/unit/ipc-contracts.test.ts`

- [ ] **Step 1: Add failing scanner tests**

```ts
it("shows a virtual group and hides its members from the category patch list", async () => {
  await createGroupWith(["分类A\\a.npk", "分类A\\b.npk"]);
  const snapshot = await scanCategory(libraryRoot, "分类A", { groups });
  expect(snapshot.value.groups).toMatchObject([{ kind: "group", id: expect.any(String), name: "套装", patchCount: 2 }]);
  expect(snapshot.value.patches.map((patch) => patch.name)).not.toContain("a.npk");
});

it("returns only live member patches for a group UUID", async () => {
  const group = await createGroupWith(["分类A\\a.npk", "分类A\\missing.npk"]);
  expect((await scanGroup(libraryRoot, group.id, { groups })).value.patches.map((patch) => patch.name)).toEqual(["a.npk"]);
});
```

- [ ] **Step 2: Run scanner tests and verify failure**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/scanner.test.ts tests/unit/ipc-contracts.test.ts`

Expected: FAIL because the scanner only discovers marker directories and no group-ID scan contract exists.

- [ ] **Step 3: Define DTO and scan APIs**

```ts
export const GroupItemSchema = z.object({
  kind: z.literal("group"),
  id: z.string().uuid(),
  name: z.string(),
  categoryRelativePath: z.string(),
  previewUrl: z.string().nullable(),
  patchCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  enabled: z.boolean(),
});

export const ScanGroupRequestSchema = z.object({ groupId: z.string().uuid() });
export const ScanGroupResultSchema = apiResultSchema(z.object({
  group: GroupItemSchema,
  patches: z.array(PatchItemSchema),
}));
```

Make `scanCategory` accept a group repository, derive groups whose `categoryRelativePath` equals the scanned category, hide every member path from loose patches, and compute category counts from real NPK files only. Implement `scanGroup` to resolve live member files by UUID and retain the parent category path for the back action. Add `library:scan-group` to IPC contracts.

- [ ] **Step 4: Run scanner and contract tests**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/scanner.test.ts tests/unit/ipc-contracts.test.ts`

Expected: PASS.

### Task 4: Bind Group Previews by UUID

**Files:**
- Modify: `src/core/state/schemas.ts`
- Modify: `src/core/previews/preview-state.ts`
- Modify: `src/core/previews/preview-service.ts`
- Modify: `src/main/ipc/decorate-snapshot.ts`
- Modify: `src/main/ipc/preview-ipc.ts`
- Test: `tests/integration/preview-service.test.ts`
- Test: `tests/integration/preview-ipc.test.ts`

- [ ] **Step 1: Write failing UUID preview tests**

```ts
it("keeps a group preview after the group is renamed", async () => {
  const group = await createGroupWith(["分类A\\a.npk", "分类A\\b.npk"]);
  await previews.set({ kind: "group", groupId: group.id }, sourceImage);
  await groups.rename(group.id, "新名称");
  expect((await previews.get({ kind: "group", groupId: group.id })).value.previewUrl).not.toBeNull();
});

it("removes only the group preview when a virtual group is dissolved", async () => {
  const group = await createGroupWith(["分类A\\a.npk", "分类A\\b.npk"]);
  await previews.set({ kind: "group", groupId: group.id }, sourceImage);
  await groups.dissolve(group.id);
  expect((await previews.get({ kind: "group", groupId: group.id })).value.previewUrl).toBeNull();
});
```

- [ ] **Step 2: Run preview tests and verify failure**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/preview-service.test.ts tests/integration/preview-ipc.test.ts`

Expected: FAIL because active group preview bindings use `relativePath`.

- [ ] **Step 3: Introduce discriminated preview references**

```ts
export const ActivePreviewBindingSchema = z.union([
  z.object({ state: z.literal("active"), kind: z.literal("patch"), relativePath: z.string().min(1), assetName: z.string().min(1) }),
  z.object({ state: z.literal("active"), kind: z.literal("group"), groupId: z.string().uuid(), assetName: z.string().min(1) }),
]);

export type PreviewReference =
  | { readonly kind: "patch"; readonly relativePath: string }
  | { readonly kind: "group"; readonly groupId: string };
```

Migrate readable version-1 group bindings during startup using the legacy path-to-ID map produced by migration; preserve patch bindings unchanged. Update preview APIs and snapshot decoration to use the discriminated reference. Dissolve and recycle must append preview-binding removal in the same transaction as group-state removal.

- [ ] **Step 4: Run preview tests**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/preview-service.test.ts tests/integration/preview-ipc.test.ts tests/integration/preview-move-lifecycle.test.ts`

Expected: PASS.

### Task 5: Resolve Virtual Groups for Installation and Recycle

**Files:**
- Modify: `src/core/install/install-sources.ts`
- Modify: `src/core/install/install-service.ts`
- Modify: `src/core/application/library-lifecycle-service.ts`
- Modify: `src/core/recycle/recycle-service.ts`
- Test: `tests/integration/install-service.test.ts`
- Test: `tests/integration/recycle-service.test.ts`
- Test: `tests/integration/library-lifecycle-service.test.ts`

- [ ] **Step 1: Add failing virtual-group install and recycle tests**

```ts
it("enables every live NPK member of a virtual group", async () => {
  const group = await createGroupWith(["分类A\\a.npk", "分类A\\b.npk"]);
  await expect(install.enable({ kind: "group", groupId: group.id })).resolves.toMatchObject({ ok: true, value: { installedCount: 2 } });
});

it("recycles every group member and removes the virtual group", async () => {
  const group = await createGroupWith(["分类A\\a.npk", "分类A\\b.npk"]);
  await lifecycle.recycle({ kind: "group", groupId: group.id });
  expect((await groups.get(group.id)).ok).toBe(false);
  await expect(access(join(categoryA, "a.npk"))).rejects.toMatchObject({ code: "ENOENT" });
});
```

- [ ] **Step 2: Run installation and recycle tests and verify failure**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/install-service.test.ts tests/integration/recycle-service.test.ts tests/integration/library-lifecycle-service.test.ts`

Expected: FAIL because group installation and recycle call `lstat` and `readdir` on a group directory.

- [ ] **Step 3: Resolve group sources through the repository**

```ts
export type InstallItemReference =
  | { readonly kind: "patch"; readonly relativePath: string }
  | { readonly kind: "group"; readonly groupId: string };

export async function resolveInstallSources(
  libraryRoot: LibraryRoot,
  item: InstallItemReference,
  groups: VirtualGroupRepository,
): Promise<Result<readonly InstallSource[], InstallSourceError>>;
```

For a group reference, fetch its state, resolve every member NPK, exclude missing files, and return `SOURCE_EMPTY` when none survive. Recycle must expand a group to member patch recycle entries, append group and preview deletion to the same transaction, and retain recovery entries for each NPK. Update all installation, preset, and lifecycle call sites to pass the repository.

- [ ] **Step 4: Run focused lifecycle tests**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/install-service.test.ts tests/integration/recycle-service.test.ts tests/integration/recycle-batch.test.ts tests/integration/library-lifecycle-service.test.ts`

Expected: PASS.

### Task 6: Register Services, Migrate Legacy Directories, and Replace IPC Contracts

**Files:**
- Create: `src/core/groups/legacy-group-migration.ts`
- Modify: `src/main/ipc/register-ipc.ts`
- Modify: `src/shared/ipc-contracts.ts`
- Modify: `src/preload/preload.ts`
- Modify: `src/main/ipc/api-result.ts`
- Test: `tests/integration/legacy-group-migration.test.ts`
- Test: `tests/integration/api-result.test.ts`

- [ ] **Step 1: Add migration tests before code**

```ts
it("migrates a marked directory into a virtual group and removes the directory", async () => {
  await createLegacyGroup(category, "旧组", ["a.npk", "b.npk"], "旧组.png");
  await migrateLegacyGroups({ libraryRoot, groups, previews });
  expect((await groups.list()).value.groups).toMatchObject([{ name: "旧组", memberRelativePaths: ["分类A\\a.npk", "分类A\\b.npk"] }]);
  await expect(access(join(category, "旧组"))).rejects.toMatchObject({ code: "ENOENT" });
});

it("rolls back NPK moves and state when migration cannot write group state", async () => {
  await createLegacyGroup(category, "旧组", ["a.npk", "b.npk"]);
  const result = await migrateLegacyGroups({ libraryRoot, groups: failingGroups, previews });
  expect(result).toEqual({ ok: false, error: { code: "TRANSACTION_FAILED" } });
  await expect(access(join(category, "旧组", "a.npk"))).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run migration tests and verify failure**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/legacy-group-migration.test.ts`

Expected: FAIL because no legacy migration service is registered.

- [ ] **Step 3: Implement and register the migration transaction**

```ts
export async function migrateLegacyGroups(options: {
  readonly libraryRoot: LibraryRoot;
  readonly groups: VirtualGroupService;
  readonly previews: PreviewService;
}): Promise<Result<{ readonly migratedCount: number }, LegacyGroupMigrationError>>;
```

For each marker directory, preflight all parent collisions and supported preview assets. Build one `FileTransactionStep[]` sequence that moves member NPK files to the parent, writes the virtual record, imports or rebinds its preview by UUID, deletes the marker, then removes the empty directory. Each filesystem and state action requires an inverse compensation step. Call this before `scan`, install, preview, and mutation handlers are registered. Replace `CreateGroupRequestSchema` and group operations with `groupId`; add `ScanGroupRequestSchema`; update preload validators and the `DnfApi` signatures.

- [ ] **Step 4: Remove obsolete marker-only command surface**

After migration tests pass, delete `src/core/library/dissolve-group.ts` and remove normal-runtime imports of `group-marker.ts`. Keep `group-marker.ts` only for `legacy-group-migration.ts`; delete it in a later release only after the supported migration window ends.

- [ ] **Step 5: Run IPC and migration tests**

Run: `rtk pnpm exec vitest run --config vitest.integration.config.ts tests/integration/legacy-group-migration.test.ts tests/integration/api-result.test.ts tests/integration/preview-ipc.test.ts`

Expected: PASS.

### Task 7: Update Renderer Navigation and Group Operations

**Files:**
- Modify: `src/renderer/workspace/model.ts`
- Modify: `src/renderer/workspace/useWorkspace.ts`
- Modify: `src/renderer/workspace/useWorkspaceOperations.ts`
- Modify: `src/renderer/components/WorkspaceApp.tsx`
- Modify: `src/renderer/components/ItemWorkspace.tsx`
- Modify: `tests/renderer/workspace.test.tsx`
- Modify: `tests/renderer/navigation.test.tsx`
- Modify: `tests/renderer/item-preview.test.tsx`
- Modify: `tests/renderer/fake-api.ts`

- [ ] **Step 1: Add renderer tests for UUID navigation**

```tsx
it("opens a virtual group by id and returns to its owning category", async () => {
  render(<WorkspaceApp client={api} />);
  await userEvent.click(await screen.findByRole("button", { name: /套装/ }));
  expect(api.scanGroup).toHaveBeenCalledWith({ groupId: "0552babf-49b5-4390-96a7-1846a0c1e9f8" });
  await userEvent.click(screen.getByRole("button", { name: "返回分类" }));
  expect(api.scan).toHaveBeenLastCalledWith({ includeDescendants: false, relativePath: "分类A" });
});

it("dissolves a group without asking the UI to move its patches", async () => {
  render(<WorkspaceApp client={api} />);
  await dissolveSelectedGroup();
  expect(api.dissolveGroup).toHaveBeenCalledWith({ groupId: "0552babf-49b5-4390-96a7-1846a0c1e9f8" });
  expect(api.moveItems).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the renderer tests and verify failure**

Run: `rtk pnpm exec vitest run tests/renderer/workspace.test.tsx tests/renderer/navigation.test.tsx tests/renderer/item-preview.test.tsx`

Expected: FAIL because navigation and preview selection use `relativePath` for groups.

- [ ] **Step 3: Change group references to UUIDs**

```ts
export type NavigationSelection =
  | { readonly kind: "all" }
  | { readonly kind: "uncategorized" }
  | { readonly kind: "category"; readonly relativePath: string }
  | { readonly kind: "group"; readonly groupId: string; readonly categoryRelativePath: string };

export type WorkspaceItemReference =
  | Pick<PatchItem, "kind" | "relativePath">
  | Pick<GroupItem, "kind" | "id">;
```

When entering a group, call `client.scanGroup({ groupId })` and display its patches. Use `{ kind: "group", groupId }` for preview, install, disable, recycle, move, rename, and dissolve calls. Preserve card drag feedback; dropping a same-category patch onto a group calls `addGroupMembers`, while a group move delegates to the group-ID move operation.

- [ ] **Step 4: Run renderer tests**

Run: `rtk pnpm exec vitest run tests/renderer/workspace.test.tsx tests/renderer/navigation.test.tsx tests/renderer/item-preview.test.tsx tests/renderer/workspace-selection.test.tsx`

Expected: PASS.

### Task 8: Complete Regression Coverage and Production Verification

**Files:**
- Modify: `tests/e2e/library-workflow.e2e.ts`
- Modify: `tests/renderer/fake-api.ts`
- Modify: `docs/superpowers/specs/2026-08-06-virtual-groups-design.md` only if implementation exposes a design mismatch.

- [ ] **Step 1: Add end-to-end virtual-group workflow**

```ts
test("creates, previews, moves, and dissolves a virtual group without creating a library folder", async ({ page }) => {
  await importPatches(page, ["a.npk", "b.npk"]);
  await createGroup(page, "套装");
  await expectLibraryDirectory(page, "分类A", ["a.npk", "b.npk"]);
  await openGroup(page, "套装");
  await moveGroupToCategory(page, "分类B");
  await dissolveGroup(page);
  await expectLibraryDirectory(page, "分类B", ["a.npk", "b.npk"]);
});
```

- [ ] **Step 2: Run the new E2E test and verify it fails before the final wiring**

Run: `rtk pnpm exec playwright test tests/e2e/library-workflow.e2e.ts`

Expected: FAIL until group-ID IPC, navigation, and operations are all connected.

- [ ] **Step 3: Run focused verification**

Run: `rtk pnpm test:unit`

Expected: PASS.

Run: `rtk pnpm test:integration`

Expected: PASS.

Run: `rtk pnpm exec playwright test tests/e2e/library-workflow.e2e.ts`

Expected: PASS.

- [ ] **Step 4: Run quality and build verification**

Run: `rtk pnpm typecheck`

Expected: `TypeScript: No errors found`.

Run: `rtk pnpm exec biome check src tests`

Expected: exit code 0.

Run: `rtk pnpm build`

Expected: Electron main, preload, and renderer bundles build successfully.

Run: `rtk git diff --check`

Expected: no output.

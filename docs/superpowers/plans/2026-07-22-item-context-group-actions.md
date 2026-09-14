# 补丁卡片与补丁组操作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为补丁与补丁组增加真实可用的启用开关、右键菜单、键盘快捷键、进入组和解散组，同时保持现有网格/列表、预览、预设和回收站行为。

**Architecture:** 复用现有 `DnfApi`、文件事务、生命周期服务和 `OperationDialogs`。核心层生成可回滚的解散组计划；主进程在 mutation mutex 中组合文件、安装记录和预览状态；渲染器只负责菜单状态、导航和调用现有操作。

**Tech Stack:** Electron, React, TypeScript, Zod, Vitest, Biome, pnpm.

---

### Task 1: 解散组核心文件事务

**Files:**
- Create: `src/core/library/dissolve-group.ts`
- Modify: `src/core/library/library-commands.ts`
- Test: `tests/integration/library-commands.test.ts`

- [ ] **Step 1: Write failing integration tests**

在 `library-commands.test.ts` 增加以下行为：创建含 `.dnf-group.json`、`coat.npk`、`sword.npk` 的组，调用 `commands.dissolveGroup({ libraryRoot, groupRelativePath: "分类\\套装" })` 后断言两个 NPK 位于 `分类`、组目录不存在；目标已有同名 `coat.npk` 时断言返回 `TARGET_CONFLICT` 且组和原文件均保留；组含 `cover.png` 时断言返回 `GROUP_CONTENT_NOT_PATCHES` 且文件树不变；用 `movePath` 在第二次移动时抛错，断言事务恢复源组和文件。

- [ ] **Step 2: Run focused tests and verify failure**

Run `pnpm vitest run tests/integration/library-commands.test.ts`.
Expected: FAIL because `dissolveGroup` and its result/error types do not exist.

- [ ] **Step 3: Implement the minimal transactional command**

在 `dissolve-group.ts` 定义 `DissolveGroupRequest`、`DissolveGroupResult`、`DissolveGroupError`、`prepareDissolveGroup` 和 `dissolveGroup`。校验组目录有效标记、父目录、内容仅为 marker 与 `.npk`、目标不存在；事务步骤依次移动 NPK、删除 marker、删除空目录，补偿步骤依次重建目录/marker并把 NPK 移回。`LibraryCommands` 增加 `dissolveGroup` 并委托该函数，保留 `createGroup` 的现有实现和错误语义。

- [ ] **Step 4: Run focused tests and verify pass**

Run `pnpm vitest run tests/integration/library-commands.test.ts`.
Expected: PASS, including conflict and rollback tests.

- [ ] **Step 5: Commit the core slice**

Run `git add src/core/library/dissolve-group.ts src/core/library/library-commands.ts tests/integration/library-commands.test.ts && git commit -m "feat: dissolve patch groups transactionally"`.

### Task 2: IPC、生命周期和类型契约

**Files:**
- Modify: `src/shared/ipc-contracts.ts`
- Modify: `src/preload/preload.ts`
- Modify: `src/preload/window.d.ts`
- Modify: `src/core/previews/preview-service.ts`
- Modify: `src/core/application/library-lifecycle-service.ts`
- Modify: `src/main/ipc/register-ipc.ts`
- Modify: `tests/unit/ipc-contracts.test.ts`
- Modify: `tests/renderer/fake-api.ts`

- [ ] **Step 1: Write failing contract and lifecycle tests**

断言 `DissolveGroupRequestSchema` 接受 `{ groupRelativePath: "分类\\套装" }`、拒绝绝对路径；断言 `IPC_CHANNELS.dissolveGroup` 存在。生命周期测试使用启用记录和预览绑定，调用 `dissolveGroup` 后断言安装记录的 source path 由 `分类\\套装\\coat.npk` 改为 `分类\\coat.npk`、group 预览绑定移除、patch 绑定保留。

- [ ] **Step 2: Run focused tests and verify failure**

Run `pnpm vitest run tests/unit/ipc-contracts.test.ts tests/integration/library-lifecycle-service.test.ts`.
Expected: FAIL because the schema, API method, preview preparation method, and lifecycle method are absent.

- [ ] **Step 3: Add typed IPC and lifecycle composition**

新增 `DissolveGroupRequestSchema`、`IPC_CHANNELS.dissolveGroup` 和 `DnfApi.dissolveGroup`。在 `PreviewService` 增加 `prepareDissolveGroup(relativePath)`，生成移除 group active binding 的可回滚步骤。生命周期服务新增 `dissolveGroup({ groupRelativePath })`：调用 `prepareDissolveGroup`、`install.prepareRelocateMany([{ kind: "group", fromRelativePath: groupRelativePath, toRelativePath: parentPath }])` 和核心 `prepareDissolveGroup`，用同一事务执行；无游戏目录时主进程只组合核心与预览步骤。同步 preload 暴露方法、fake API 和主进程注册 handler，所有调用在已有 `mutationMutex` 内完成。

- [ ] **Step 4: Run focused tests and verify pass**

Run `pnpm vitest run tests/unit/ipc-contracts.test.ts tests/integration/library-lifecycle-service.test.ts`.
Expected: PASS and TypeScript accepts the expanded `DnfApi`.

- [ ] **Step 5: Commit the IPC slice**

Run `git add src/shared/ipc-contracts.ts src/preload/preload.ts src/preload/window.d.ts src/core/previews/preview-service.ts src/core/application/library-lifecycle-service.ts src/main/ipc/register-ipc.ts tests/unit/ipc-contracts.test.ts tests/renderer/fake-api.ts && git commit -m "feat: expose dissolve group lifecycle"`.

### Task 3: 卡片开关、右键菜单和快捷键

**Files:**
- Modify: `src/renderer/workspace/model.ts`
- Modify: `src/renderer/workspace/useWorkspace.ts`
- Modify: `src/renderer/components/WorkspaceApp.tsx`
- Modify: `src/renderer/components/ItemWorkspace.tsx`
- Modify: `src/renderer/components/OperationDialogs.tsx`
- Modify: `src/renderer/styles/items.css`
- Modify: `src/renderer/styles/operations.css`
- Test: `tests/renderer/operations.test.tsx`
- Test: `tests/renderer/item-preview.test.tsx`

- [ ] **Step 1: Write failing renderer tests**

增加断言：普通卡片显示自定义 `switch`，点击 checkbox 调用 `enableItems`/`disableItems` 且不改变选中；普通卡片右键菜单按“移动、打组、加入预设、重命名、删除”顺序显示；组卡片显示“移动、进入组、解散组、加入预设、重命名、删除”；`Ctrl+G` 打开 group 对话框、单选 `F2` 打开 rename、`Delete` 打开 recycle；进入组触发 category 扫描到组路径；预览双击仍只调用 `selectItemPreview`。

- [ ] **Step 2: Run focused tests and verify failure**

Run `pnpm vitest run tests/renderer/operations.test.tsx tests/renderer/item-preview.test.tsx`.
Expected: FAIL because menu, switch, keyboard handlers and group navigation callbacks are absent.

- [ ] **Step 3: Implement renderer behavior**

扩展 `NavigationSelection` 为明确的 `{ kind: "group"; relativePath: string }`，将组进入动作接到 `workspace.setCategoryPath`/导航状态；`useWorkspace` 在 group 导航下扫描该目录且不显示分类树中的普通组。`ItemWorkspace` 增加菜单状态、document-level Escape/外部点击关闭、右键选中逻辑及菜单按钮回调；根据 `item.kind` 渲染两组菜单，隐藏剪切/粘贴。卡片 body 右下角渲染 `<label className="switch"><input ... /><span className="slider" /></label>`，阻止 click/double-click 冒泡。监听卡片/工作区键盘事件实现 `Ctrl+G`、`F2`、`Delete`，只读或 busy 时不触发。把解散动作接到新的 `OperationDialog`。

- [ ] **Step 4: Add scoped CSS and run focused tests**

在 `items.css` 增加菜单定位、分隔线、开关和列表视图兼容样式，保留 `.item-preview { aspect-ratio: 4 / 3; }`；在 `operations.css` 仅补充菜单层级和焦点样式。运行同一组 Vitest，Expected: PASS。

- [ ] **Step 5: Commit the renderer slice**

Run `git add src/renderer/workspace/model.ts src/renderer/workspace/useWorkspace.ts src/renderer/components/WorkspaceApp.tsx src/renderer/components/ItemWorkspace.tsx src/renderer/components/OperationDialogs.tsx src/renderer/styles/items.css src/renderer/styles/operations.css tests/renderer/operations.test.tsx tests/renderer/item-preview.test.tsx && git commit -m "feat: add patch card actions and shortcuts"`.

### Task 4: 全量验证与交付检查

**Files:**
- Modify only files required by failing checks; do not stage unrelated existing changes.

- [ ] **Step 1: Run static checks**

Run `pnpm typecheck` and `pnpm biome check .`. Expected: both exit 0.

- [ ] **Step 2: Run all automated tests**

Run `pnpm vitest run`. Expected: all test files and assertions pass, including new core, IPC, lifecycle and renderer coverage.

- [ ] **Step 3: Run build and delivery checks**

Run `pnpm build`, `pnpm verify:portable`, `pnpm verify:packaged`, and the existing BAT `--check` command from `package.json`. Expected: each exits 0; if a check cannot run on this machine, report it explicitly instead of claiming completion.

- [ ] **Step 4: Inspect final diff and status**

Run `git diff --check`, `git status --short --branch`, and `git diff --stat HEAD~3..HEAD`. Confirm only the three feature commits plus the already-existing user changes are present; do not reset or delete `重构/`.

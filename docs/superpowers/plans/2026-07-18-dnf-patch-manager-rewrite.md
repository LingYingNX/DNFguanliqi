# DNF 补丁管理器重写实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零交付一个行为完整、文件事务可靠、使用 Halo 界面的 DNF 补丁管理器 portable 应用。

**Architecture:** Electron 主进程拥有磁盘和状态，预加载层暴露类型化 API，React 渲染层只消费 API。领域类型、文件适配器和应用用例分离；所有多文件写操作使用预检、执行、补偿和原子状态提交。

**Tech Stack:** Electron, TypeScript, React, Vite, Zod, Vitest, Testing Library, Playwright, electron-builder, Lucide React.

---

## 文件结构

```text
src/
|- main/
|  |- app-paths.ts                 # 开发/portable 数据根解析
|  |- main.ts                      # BrowserWindow 和生命周期
|  `- ipc/register-ipc.ts          # IPC 注册与边界解析
|- preload/
|  `- preload.ts                   # window.dnf API
|- shared/
|  |- contracts.ts                 # IPC 请求/响应和公开领域 DTO
|  `- errors.ts                    # 稳定错误联合
|- core/
|  |- paths/library-path.ts        # 库内安全路径
|  |- state/atomic-json-store.ts   # 原子 JSON 存储
|  |- state/schemas.ts             # Zod 状态模型
|  |- library/scanner.ts           # 分类/补丁/组扫描
|  |- library/library-commands.ts  # 导入/移动/重命名/打组
|  |- recycle/recycle-service.ts   # 回收和恢复
|  `- install/install-service.ts   # 启停事务
`- renderer/
   |- App.tsx                      # 工作台组合
   |- api/client.ts                # window.dnf 访问
   |- state/workspace.ts           # 选择、筛选、视图状态
   |- components/                  # 工具栏、分类栏、项目区、检查器、弹窗
   `- styles/                      # Halo 令牌和应用布局
tests/
|- unit/
|- integration/
|- renderer/
`- e2e/
```

## Task 1：独立仓库和可运行 Electron 基线

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main/main.ts`
- Create: `src/preload/preload.ts`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/styles/base.css`
- Test: `tests/unit/smoke.test.ts`

- [ ] **Step 1: 初始化无历史 master 仓库**

Run: `git init -b master`

Expected: `git branch --show-current` 输出 `master`，`git rev-list --all --count` 输出 `0`。

- [ ] **Step 2: 写缺失基线的失败测试**

```ts
import { describe, expect, it } from "vitest";
import { APP_NAME, APP_VERSION } from "../../src/shared/contracts";

describe("application identity", () => {
  it("keeps the visible and packaged identity aligned", () => {
    expect(APP_NAME).toBe("DNF 补丁管理器");
    expect(APP_VERSION).toBe("1.1.0");
  });
});
```

Run: `pnpm vitest run tests/unit/smoke.test.ts`

Expected: FAIL because `src/shared/contracts.ts` does not exist.

- [ ] **Step 3: 建立严格项目配置和最小窗口**

`package.json` scripts must include `dev`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build`, and `dist:portable`. `tsconfig.json` must enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `verbatimModuleSyntax`.

`src/shared/contracts.ts` starts with:

```ts
export const APP_NAME = "DNF 补丁管理器";
export const APP_VERSION = "1.1.0";
```

The BrowserWindow must use `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and the preload bundle.

- [ ] **Step 4: 安装依赖并验证**

Run: `pnpm install`

Run: `pnpm typecheck`

Run: `pnpm test`

Expected: all commands exit 0.

- [ ] **Step 5: 提交基线**

Run: `git add .gitignore package.json pnpm-lock.yaml tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts index.html src tests docs 前端`

Run: `git commit -m "chore: initialize clean rewrite"`

## Task 2：便携路径和类型化状态存储

**Files:**
- Create: `src/main/app-paths.ts`
- Create: `src/core/state/schemas.ts`
- Create: `src/core/state/atomic-json-store.ts`
- Test: `tests/unit/app-paths.test.ts`
- Test: `tests/integration/atomic-json-store.test.ts`

- [ ] **Step 1: 先写路径失败测试**

```ts
it("places portable data beside the executable", () => {
  const paths = resolveAppPaths({ mode: "portable", executable: "C:\\Tools\\DNF补丁管理器.exe" });
  expect(paths.dataRoot).toBe("C:\\Tools\\data");
  expect(paths.libraryRoot).toBe("C:\\Tools\\patch-categories");
});
```

- [ ] **Step 2: 实现 branded 路径和模式穷尽分支**

Use distinct `DataRoot`, `LibraryRoot`, and `GameRoot` string brands. `resolveAppPaths` accepts a discriminated union and uses an exhaustive switch.

- [ ] **Step 3: 写原子状态失败测试**

Test valid round-trip, malformed JSON returning `STATE_CORRUPTED`, and injected rename failure preserving the previous file.

- [ ] **Step 4: 实现 Zod schema 与原子替换**

Write UTF-8 JSON to a uniquely named file in the same directory, sync and close it, then rename it over the target. Parse once at the store boundary. Never convert malformed JSON to defaults.

- [ ] **Step 5: 运行并提交**

Run: `pnpm vitest run tests/unit/app-paths.test.ts tests/integration/atomic-json-store.test.ts`

Expected: PASS.

Run: `git commit -am "feat: add portable paths and atomic state"`

## Task 3：真实分类、补丁和组扫描

**Files:**
- Create: `src/core/paths/library-path.ts`
- Create: `src/core/library/scanner.ts`
- Extend: `src/shared/contracts.ts`
- Test: `tests/unit/library-path.test.ts`
- Test: `tests/integration/scanner.test.ts`

- [ ] **Step 1: 写越界路径测试**

Test that `../outside.npk`, absolute paths, and a sibling prefix such as `patch-categories-old` are rejected.

- [ ] **Step 2: 实现安全相对路径解析**

Resolve against the library root, compare normalized path segments, and return a typed `PATH_OUTSIDE_LIBRARY` error.

- [ ] **Step 3: 写真实扫描测试**

Fixture contains a category NPK, child category NPK, valid group with two NPK and `.dnf-group.json`, invalid marker, image, and unrelated file. Assert parent results are non-recursive and only a valid marker makes a group.

- [ ] **Step 4: 实现扫描器**

Return immutable DTOs for category, patch, and group. Include relative path, size, modified time, preview path, enabled state placeholder, and group child count.

- [ ] **Step 5: 运行并提交**

Run: `pnpm vitest run tests/unit/library-path.test.ts tests/integration/scanner.test.ts`

Run: `git commit -am "feat: scan real patch library"`

## Task 4：导入、移动、重命名和真实打组

**Files:**
- Create: `src/core/filesystem/file-transaction.ts`
- Create: `src/core/library/library-commands.ts`
- Test: `tests/integration/library-commands.test.ts`

- [ ] **Step 1: 写导入和冲突测试**

Assert only NPK files import, exact duplicates are reported, and same-name different-content files block the whole command.

- [ ] **Step 2: 实现通用文件事务执行器**

The executor accepts precomputed steps with `apply` and `compensate`; it records only completed steps and compensates them in reverse order on failure.

- [ ] **Step 3: 写打组失败测试**

Select two NPK in one category, create a group, and assert a real directory, both moved files, and valid `.dnf-group.json`. Inject a second move failure and assert the original tree is unchanged.

- [ ] **Step 4: 实现库命令**

Preflight every source and target before invoking the transaction. Group IDs use `crypto.randomUUID()`. Cross-category grouping is rejected.

- [ ] **Step 5: 写移动和重命名测试并实现**

Cover patch-to-category, patch-to-group, group-to-category, group rename, and target collisions.

- [ ] **Step 6: 运行并提交**

Run: `pnpm vitest run tests/integration/library-commands.test.ts`

Run: `git commit -am "feat: add transactional library commands"`

## Task 5：回收站和完整恢复

**Files:**
- Create: `src/core/recycle/recycle-service.ts`
- Extend: `src/core/state/schemas.ts`
- Test: `tests/integration/recycle-service.test.ts`

- [ ] **Step 1: 写组恢复回归测试**

Given a group with marker, preview and two NPK, when recycled and restored, then the exact original tree and metadata are restored.

- [ ] **Step 2: 写恢复冲突测试**

Create a file at the original location after recycle. Restore must return `TARGET_CONFLICT` and leave both trees unchanged.

- [ ] **Step 3: 实现回收清单和事务**

Store item ID, kind, original relative path, recycle relative path and recycled timestamp. Move the complete item directory/file. Commit manifest only after the move succeeds.

- [ ] **Step 4: 实现恢复和清空**

Restore uses the same transaction discipline. Emptying requires an explicit `confirmed: true` request.

- [ ] **Step 5: 运行并提交**

Run: `pnpm vitest run tests/integration/recycle-service.test.ts`

Run: `git commit -am "feat: add complete recycle and restore"`

## Task 6：单补丁和组启停事务

**Files:**
- Create: `src/core/install/install-service.ts`
- Extend: `src/core/state/schemas.ts`
- Test: `tests/integration/install-service.test.ts`

- [ ] **Step 1: 写单补丁启停测试**

Assert enable copies bytes and records both hashes. Disable removes only an unchanged target and deletes the matching record.

- [ ] **Step 2: 写外部修改保护测试**

After enable, modify the game file. Disable must return `TARGET_MODIFIED`, preserve the file, and preserve the record.

- [ ] **Step 3: 写组原子性回归测试**

Create a conflict for the second group member. Enabling the group must copy zero files and write zero records.

- [ ] **Step 4: 实现安装服务**

Precompute source and target hashes, reject all conflicts before copying, copy through the transaction executor, then atomically replace installation state.

- [ ] **Step 5: 写已启用项目重命名/删除回归测试并实现协调**

Renaming an enabled patch updates or renames the game target and record without leaving the old target. Recycling an enabled item first performs safe disable; any disable conflict aborts recycling.

- [ ] **Step 6: 运行并提交**

Run: `pnpm vitest run tests/integration/install-service.test.ts tests/integration/library-commands.test.ts tests/integration/recycle-service.test.ts`

Run: `git commit -am "feat: add atomic patch installation"`

## Task 7：类型化 IPC 和预加载 API

**Files:**
- Create: `src/main/ipc/register-ipc.ts`
- Modify: `src/preload/preload.ts`
- Extend: `src/shared/contracts.ts`
- Test: `tests/unit/ipc-contracts.test.ts`

- [ ] **Step 1: 写边界解析测试**

For each command family, test a valid request and one invalid relative path or missing field. Invalid requests must return `INVALID_INPUT` before a service is called.

- [ ] **Step 2: 定义结果联合**

```ts
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AppError };
```

- [ ] **Step 3: 注册命名通道**

Register library, installation, appearance, settings and category-order handlers. Parse request schemas at the handler boundary and convert typed errors to DTOs.

- [ ] **Step 4: 暴露最小 window.dnf**

Expose functions only; do not expose `ipcRenderer`, channel strings, filesystem APIs or generic invoke.

- [ ] **Step 5: 运行并提交**

Run: `pnpm vitest run tests/unit/ipc-contracts.test.ts`

Run: `git commit -am "feat: expose typed desktop API"`

## Task 8：Halo 工作台只读界面

**Files:**
- Create: `src/renderer/styles/tokens.css`
- Create: `src/renderer/styles/workspace.css`
- Create: `src/renderer/api/client.ts`
- Create: `src/renderer/state/workspace.ts`
- Create: `src/renderer/components/AppToolbar.tsx`
- Create: `src/renderer/components/CategorySidebar.tsx`
- Create: `src/renderer/components/ItemWorkspace.tsx`
- Create: `src/renderer/components/Inspector.tsx`
- Modify: `src/renderer/App.tsx`
- Test: `tests/renderer/workspace.test.tsx`

- [ ] **Step 1: 写首屏渲染失败测试**

Assert the application shows import, search, filters, category tree, item area, inspector and version using a fake typed API.

- [ ] **Step 2: 迁移 Halo 令牌**

Copy design values, not showcase layout. Use the provided near-black surfaces, 1px borders, indigo action, signal colors and motion durations. Keep card radius at 8px.

- [ ] **Step 3: 实现响应式工作台**

Use fixed toolbar height, constrained sidebar/inspector widths and a stable item grid. Support 1280x720 without overlap. Use Lucide React icons and native tooltips/ARIA labels.

- [ ] **Step 4: 实现搜索、筛选、视图和尺寸状态**

The reducer must use discriminated actions and exhaustive matching. Grid/list and size controls cannot resize the toolbar.

- [ ] **Step 5: 运行并提交**

Run: `pnpm vitest run tests/renderer/workspace.test.tsx`

Run: `git commit -am "feat: build Halo patch workspace"`

## Task 9：完整界面命令与选择交互

**Files:**
- Create: `src/renderer/components/CommandDialogs.tsx`
- Create: `src/renderer/components/ContextMenu.tsx`
- Create: `src/renderer/components/RecycleBinView.tsx`
- Extend: `src/renderer/state/workspace.ts`
- Test: `tests/renderer/interactions.test.tsx`
- Test: `tests/e2e/library-workflow.spec.ts`

- [ ] **Step 1: 写选择行为测试**

Cover single, Ctrl toggle, Shift range and drag-box selection for patches and groups.

- [ ] **Step 2: 实现命令弹窗和通知**

Cover rename, group creation, move, conflict details and destructive confirmation. Context menu must not contain preview selection.

- [ ] **Step 3: 实现分类指针排序**

Pointer-down on any category starts ordering without first changing selection. Persist the resulting order through the typed API.

- [ ] **Step 4: 实现拖放导入和项目移动**

Parse dropped file paths in preload/main, not renderer filesystem code. Display per-command success or typed error details.

- [ ] **Step 5: 写并运行 Electron E2E**

Drive a temp library through import, grouping, enable, disable, recycle and restore. Assert both UI state and resulting filesystem tree.

- [ ] **Step 6: 提交**

Run: `git commit -am "feat: complete patch management workflows"`

## Task 10：预览、壁纸和主题

**Files:**
- Create: `src/core/appearance/appearance-service.ts`
- Create: `src/renderer/components/AppearanceSettings.tsx`
- Extend: `src/core/state/schemas.ts`
- Test: `tests/integration/appearance-service.test.ts`
- Test: `tests/e2e/appearance.spec.ts`

- [ ] **Step 1: 写预览测试**

Double-clicking a patch or group preview invokes image selection and persists a stable copied asset. Test both item kinds.

- [ ] **Step 2: 实现五槽壁纸状态**

Slots are fixed indices 0-4. Import copies the asset under `data/wallpapers`; delete removes only the selected managed asset after state commit can succeed.

- [ ] **Step 3: 实现参数和主题**

Persist temperature, saturation, contrast, scale, opacity, blur, x/y position, theme, category text and selected tint with bounded Zod schemas.

- [ ] **Step 4: 运行截图 E2E**

Capture 1280x720, 1440x900 and 1920x1080. Assert no overflow and inspect the screenshots for blank areas, overlap and illegible wallpaper contrast.

- [ ] **Step 5: 提交**

Run: `git commit -am "feat: add previews and appearance settings"`

## Task 11：portable 打包和启动脚本

**Files:**
- Create: `build/icon.ico`
- Create: `scripts/verify-portable.mjs`
- Create: `启动DNF补丁管理器.bat`
- Modify: `package.json`
- Test: `tests/e2e/portable.spec.ts`

- [ ] **Step 1: 配置 electron-builder**

Set product name `DNF补丁管理器`, app ID, x64 portable target, ASAR, icon and artifact `DNF补丁管理器-1.1.0-portable.exe`. Include only build output and package metadata.

- [ ] **Step 2: 创建稳健 BAT**

The script resolves `%~dp0`, checks `node_modules\electron\dist\electron.exe`, runs `pnpm install` when dependencies are absent, and starts through the package script with quoted paths. It must not concatenate malformed Chinese paths.

- [ ] **Step 3: 在英文临时路径打包**

Run: `pnpm dist:portable`

Expected: portable exe exists and exits the verification probe successfully.

- [ ] **Step 4: 验证便携数据位置**

Launch the exe beside empty `data` and `patch-categories`; assert both are created there and no application data is written under AppData.

- [ ] **Step 5: 提交**

Run: `git commit -am "build: package portable application"`

## Task 12：完成度审计

**Files:**
- Create: `docs/verification/2026-07-18-completion-audit.md`

- [ ] **Step 1: 执行全部静态与测试门禁**

Run: `pnpm typecheck`

Run: `pnpm test`

Run: `pnpm test:integration`

Run: `pnpm test:e2e`

Run: `pnpm build`

Run: `pnpm dist:portable`

- [ ] **Step 2: 逐项对照设计规格**

For every feature and invariant in the design, record the authoritative test, screenshot, filesystem tree or packaged-app observation. Missing evidence remains incomplete.

- [ ] **Step 3: 检查仓库边界**

Run: `git status --short --branch`

Run: `git ls-files`

Verify runtime `data`, `patch-categories`, screenshots, caches, dependencies and build outputs are ignored.

- [ ] **Step 4: 提交审计**

Run: `git add docs/verification`

Run: `git commit -m "docs: record rewrite completion evidence"`

Expected: clean worktree on `master`, all required evidence present, and no remote operation performed.

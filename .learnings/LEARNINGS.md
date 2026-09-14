# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260803-001] best_practice

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: high
**Status**: promoted
**Area**: docs

### Summary
跨会话记录必须以 transcript 事件、当前仓库和 Git 状态交叉核对，不能只依据标题、预览或旧恢复报告。

### Details
本项目的 Codex transcript 会出现标题变化、同一文件包含多个 session_meta、工作树与主仓库路径并存，以及历史结论早于后续提交的情况。当前源码和当前 Git 状态优先于历史摘要；历史摘要只能作为待核对线索。

### Suggested Action
先用会话候选器按 cwd 筛选，再用投影事件读取用户/代理消息、工具证据和停止点；记录 ID、文件路径、时间和不一致，不复制完整 transcript。

### Metadata
- Source: conversation
- Related Files: C:\Users\LYNX\.codex\sessions, docs/PROJECT_MEMORY.md
- Tags: sessions, evidence, traceability
- Pattern-Key: docs.session-traceability
- See Also: LRN-20260721-003

### Promotion
- Promoted: E:\BaiduSyncdisk\知识库\DNF补丁管理器\知识库_项目沉淀总览.md

---

## [LRN-20260803-002] best_practice

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: high
**Status**: promoted
**Area**: tests

### Summary
文件操作和 UI 操作必须分别验证真实磁盘结果、状态 JSON 和真实 Electron 交互。

### Details
历史会话反复暴露“单测绿但真实 UI/磁盘边界未验证”的风险。分类跨层级移动只有在目录、嵌套子目录、顺序文件和 Electron 落点都正确时才算完成；窗口 E2E 超时也不能被静默标记为通过。

### Suggested Action
先用集成测试锁定文件树和事务，再用 renderer 测试锁定用户意图，最后用窄范围 Electron E2E 锁定真实坐标、IPC 和异步写入。

### Metadata
- Source: conversation
- Related Files: tests/integration, tests/renderer, tests/e2e
- Tags: filesystem, electron, verification
- Pattern-Key: tests.real-user-evidence

### Promotion
- Promoted: E:\BaiduSyncdisk\知识库\DNF补丁管理器\知识库_项目沉淀总览.md

---

## [LRN-20260803-003] insight

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: high
**Status**: promoted
**Area**: frontend

### Summary
Windows 式框选的关键是完整手势面与子控件边界，而不是只放行某个卡片热点。

### Details
旧逻辑只监听 .item-grid 空白区，并要求 event.target === event.currentTarget；预览热点、面板内边距和卡片拖放会把同一鼠标动作交给不同事件路径。后续修复把候选手势面扩展到主面板，同时保留卡片主体的原生拖放语义。

### Suggested Action
遇到间歇性框选问题，先列出 pointerdown/pointermove/pointerup、pointercancel、draggable 和按钮/表单命中边界，再用真实拖动回归测试锁定用户意图。

### Metadata
- Source: conversation
- Related Files: src/renderer/components/ItemWorkspace.tsx, tests/renderer/workspace-selection.test.tsx
- Tags: pointer-events, selection, drag
- Pattern-Key: ui.event-surface-conflict

### Promotion
- Promoted: E:\BaiduSyncdisk\知识库\DNF补丁管理器\学习记录.md

## [LRN-20260804-003] best_practice

**Logged**: 2026-08-04T13:06:24+08:00
**Priority**: high
**Status**: promoted
**Area**: config

### Summary
分支合并后必须验证目标分支真的包含所有预期分支提交，不能只检查切换成功或目标分支移动了位置。

### Details
用户反馈 worktree 功能合并到 master 后软件没有变化。证据显示 master 之前停在外观分支 e1d4a7a，而操作逻辑分支 b0b8203 的 939c37f 和 b0b8203 从未进入 master；缺少手动游戏目录输入、递归分类/补丁计数、分类移动、拖放和框选等功能。真正合并提交 f0ee8cd 的父提交为 e1d4a7a 和 b0b8203，才同时包含两边结果。

### Suggested Action
合并前确认预期分支 head，合并后用 `git merge-base --is-ancestor <branch> master`、`git branch --contains <commit>` 或检查 merge commit 的 parents 验证；同时从两个分支都跑受影响 UI/E2E，不能只依赖目标分支日志。

### Metadata
- Source: conversation
- Related Files: E:\codex目录\DNF, src/renderer/components/ItemWorkspace.tsx, src/core/library/category-commands.ts
- Tags: git, merge, branch, verification
- Pattern-Key: vcs.incomplete-merge
- Recurrence-Count: 1
- First-Seen: 2026-08-04
- Last-Seen: 2026-08-04

### Promotion
- Promoted: docs/MAINTENANCE.md

---

## [LRN-20260803-004] best_practice

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: high
**Status**: promoted
**Area**: backend

### Summary
分类跨父级移动必须把磁盘目录迁移、顺序路径迁移和导航刷新作为一个契约验证。

### Details
用户确认了三种落点：目标行中部成为子级，上/下边缘成为同级前/后。历史实现只有同级排序；新实现需要拒绝根目录、自身/子目录和同名覆盖，并保留被移动目录的 NPK 与嵌套子分类。

### Suggested Action
后端一次性校验并执行目录移动与顺序更新，失败时保持原状态；前端只提交落点意图，成功后重新扫描树，不先伪造本地状态。

### Metadata
- Source: conversation
- Related Files: src/core/library/category-commands.ts, src/main/ipc/category-transfer-ipc.ts, src/renderer/components/CategoryTree.tsx
- Tags: categories, filesystem, ordering
- Pattern-Key: fs.atomic-tree-move

### Promotion
- Promoted: E:\BaiduSyncdisk\知识库\DNF补丁管理器\知识库_项目沉淀总览.md

---

## [LRN-20260803-005] knowledge_gap

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: high
**Status**: pending
**Area**: tests

### Summary
预览图从受管资源改为库内同名文件后，移动、回收和解散组的生命周期覆盖需要重新核验。

### Details
2026-07-31 的只读审查发现，扫描和预览协议已读取库内同名图片，但旧的移动/回收/解散组路径主要只处理 NPK 或 marker；现有测试仍偏向旧 managed preview 绑定，因此“测试全绿”不能证明同名图片生命周期完整。

### Suggested Action
检查当前 moveLibraryItem(s)、回收、组解散和预览扫描调用链；补充“移动/回收/恢复/解散后同名图片仍正确或按契约处理”的真实文件测试。完成前不要把该风险标为 resolved。

### Metadata
- Source: conversation
- Related Files: src/core/library, src/core/previews, tests/integration, tests/e2e
- Tags: preview, lifecycle, regression
- Pattern-Key: fs.preview-lifecycle
- See Also: transcript 019fb760-0e83-7692-8226-a3b49b9a8028

---

## [LRN-20260803-006] best_practice

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: medium
**Status**: promoted
**Area**: tests

### Summary
全量测试超时必须隔离复跑并区分资源竞争、测试时序和稳定业务失败。

### Details
7 月 27 日、7 月 31 日和 8 月 2-3 日的会话都出现过全量并行超时；隔离或串行后通过。会话中保留了首次失败、隔离结果和最终门禁，避免把偶发超时改成脆弱业务逻辑，也避免把真实失败误报为 flaky。

### Suggested Action
记录精确测试文件、退出码和超时位置；先单 worker/单文件复跑，再决定是否改代码或测试配置。

### Metadata
- Source: conversation
- Related Files: tests/renderer, tests/e2e, docs/MAINTENANCE.md
- Tags: vitest, playwright, flaky, timing
- Pattern-Key: tests.parallel-timeout

### Promotion
- Promoted: E:\BaiduSyncdisk\知识库\DNF补丁管理器\错误记录.md

---

## [LRN-20260803-007] best_practice

**Logged**: 2026-08-03T18:00:00+08:00
**Priority**: high
**Status**: promoted
**Area**: config

### Summary
未经明确授权，不应把私有源码或样式上传到外部设计/审查服务。

### Details
8 月 3 日 appearance worktree 的审批记录拒绝了向外部 SuperDesign 服务上传本地源文件内容的操作；只读审查、窄范围 mock 和本地验证与完整源码外发不是同一权限。

### Suggested Action
外部服务调用前明确 payload、目的地和授权范围；优先使用本地仓库、脱敏摘要和局部 mock。

### Metadata
- Source: conversation
- Related Files: C:\Users\LYNX\.codex\sessions\2026\08\03
- Tags: external-egress, privacy, review
- Pattern-Key: security.external-egress

### Promotion
- Promoted: E:\BaiduSyncdisk\知识库\DNF补丁管理器\学习记录.md

---

## [LRN-20260811-001] correction

**Logged**: 2026-08-11T16:47:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
外观设置中的导航栏颜色必须只作用于左侧分类文件夹树，不能覆盖应用的全局文字颜色。

### Details
用户指出此前导航栏颜色改动范围过大，错误地影响了标题、系统导航、工具栏和工作区。正确边界是 `.category-tree` 内的分类名称、图标、展开控件与数量；补丁卡片颜色保持独立控制。

### Suggested Action
将可配置颜色限定到领域组件选择器，避免在 `:root` 上覆盖通用文本 token；对这类外观设置变更同时检查受影响选择器和用户可见范围。

### Metadata
- Source: user_feedback
- Related Files: src/renderer/workspace/useAppearance.ts, src/renderer/styles/layout.css, src/renderer/styles/items.css
- Tags: appearance, css, scope, regression
- Pattern-Key: frontend.color-scope
- Recurrence-Count: 1
- First-Seen: 2026-08-11
- Last-Seen: 2026-08-11

### Resolution
- **Resolved**: 2026-08-11T16:47:00+08:00
- **Notes**: 删除字体家族和全局文本颜色覆盖；导航色仅由 `.category-tree` 消费，卡片色仅由卡片文字消费。

---

## [LRN-20260811-002] correction

**Logged**: 2026-08-11T17:00:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
局部内容区域需要收紧时，应保留共享弹窗的既有尺寸，允许未使用空间存在。

### Details
用户要求压缩字体颜色控件、去除重复内框并顶部对齐；错误地将这一要求推导为缩小整个外观弹窗。正确做法是只收紧内部面板，维持其他页共用的外层尺寸。

### Suggested Action
对共享对话框的局部视觉优化，优先修改内容容器的边框、填充和排列；除非用户明确要求，不改变对话框外层宽高。

### Metadata
- Source: user_feedback
- Related Files: src/renderer/styles/settings.css, src/renderer/components/AppearanceDialog.tsx
- Tags: appearance, dialog, layout, scope
- Pattern-Key: frontend.panel-sizing
- Recurrence-Count: 1
- First-Seen: 2026-08-11
- Last-Seen: 2026-08-11

### Resolution
- **Resolved**: 2026-08-11T17:00:00+08:00
- **Notes**: 恢复外层尺寸；保留内部单层、顶部对齐的紧凑布局。

---

## [LRN-20260819-001] correction

**Logged**: 2026-08-19T17:08:00+08:00
**Priority**: high
**Status**: resolved
**Area**: config

### Summary
The only supported Windows release format is one x64 portable EXE; the NSIS installer is obsolete.

### Details
The user corrected the planned NSIS installer delivery. The release contract is a single portable executable that keeps data and patch-categories beside the EXE. The NSIS build target, scripts, specification, validation script, and stale installer artifacts were removed.

### Suggested Action
Use pnpm verify:portable followed by pnpm verify:packaged for release evidence. Confirm dist contains only DNF-patch-manager-<version>-portable.exe. Do not restore an NSIS target without a new explicit user request.

### Metadata
- Source: user_feedback
- Related Files: package.json, scripts/verify-portable.mjs, scripts/verify-packaged.mjs, docs/FUNCTION_MODULES.md
- Tags: release, electron-builder, portable, packaging
- Pattern-Key: release.portable-only
- Recurrence-Count: 1
- First-Seen: 2026-08-19
- Last-Seen: 2026-08-19

### Resolution
- **Resolved**: 2026-08-19T17:08:00+08:00
- **Notes**: Built and launched DNF-patch-manager-1.2.1-portable.exe; the sandbox verified same-directory data creation, patch scan, and AppData isolation.

---

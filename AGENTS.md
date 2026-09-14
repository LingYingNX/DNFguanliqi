# AGENTS.md

> 本文件面向 AI 代理/维护者，不是给人类用户看的用户手册。人类文档见 `docs/`。

## 项目概览

DNF 补丁管理器（`dnf-patch-manager-rewrite`）是一个 Windows 桌面 Electron + React + TypeScript 应用，用于管理用户本地 DNF `.npk` 补丁库。只管理用户已有文件；不做在线下载、社区分发或游戏逻辑修改。

| 项 | 值 |
|----|----|
| 类型 | Electron + React + TypeScript 桌面应用 |
| 包管理器 | pnpm 11.5.2 |
| Node | >= 24 |
| 构建 | electron-vite，产物输出 `out/` |
| 打包 | electron-builder，产物 `dist/`（portable x64） |
| 测试 | vitest + @testing-library + playwright |
| 代码检查 | biome + tsc |
| CI | 无 |

## 常用命令

```powershell
pnpm install --frozen-lockfile   # 安装依赖（锁文件）
pnpm dev                         # 开发（electron-vite dev）
pnpm build                       # 构建 out/
pnpm start                       # 预览构建产物
pnpm typecheck                   # tsc --noEmit
pnpm lint                        # biome check .
pnpm format                      # biome format --write .
pnpm test                        # vitest run
pnpm test:unit                   # vitest run tests/unit
pnpm test:integration            # vitest run --config vitest.integration.config.ts
pnpm test:e2e                    # pnpm build && playwright test
pnpm dist:portable               # 打包 portable 可执行文件
pnpm verify:portable             # 校验 portable 产物
pnpm verify:packaged             # 校验打包产物
pnpm doctor                      # react-doctor 诊断
```

日常启动：直接双击 `启动DNF补丁管理器.bat`（装依赖、补 Electron、构建过期产物，再启动）。`启动DNF补丁管理器.bat --check` 只做完整性校验，不启动应用。

## 目录结构

| 目录 | 职责 |
|------|------|
| `src/main` | Electron 主进程、窗口、`ipc/`、资源协议 |
| `src/preload` | 预加载桥接 |
| `src/renderer` | React UI（`components/`、`styles/`、`workspace/`） |
| `src/shared` | 主进程/渲染进程共享类型 |
| `src/core` | 业务逻辑，按域拆分 |
| `src/core/filesystem` | 文件事务、hash、路径存在性 |
| `src/core/install` | 安装/启用/禁用/迁移/边界 |
| `src/core/library` | 扫描、导入、分类、移动、预览 |
| `src/core/recycle` | 回收站清单与恢复 |
| `src/core/state` | 原子 JSON 存储与 schema |
| `src/core/groups` | 虚拟分组与迁移 |
| `src/core/presets` | 预设 |
| `src/core/appearance` | 外观设置 |
| `src/core/wallpapers` | 壁纸 |
| `src/core/concurrency` | async-mutex |
| `tests/` | 单元/集成/端到端测试 |
| `docs/` | 用户手册、项目记忆、ADR、规划/规格、审计 |
| `scripts/` | 产物校验等打包脚本 |

## 工作约定（Global Working Agreements）

### 环境（不能靠推断）

- Shell 是 **Windows PowerShell**。`2>/dev/null`、`head`、`grep`、`sed`、`ls -la` 不适用；改用 `2>$null` / `-ErrorAction SilentlyContinue`、`Select-Object -First N`、`Select-String`、`Get-ChildItem`。
- 路径含中文和空格，始终使用 `-LiteralPath`；控制台/文件 I/O 保持 UTF-8。
- Approval 为 `never`，sandbox 为 `danger-full-access`；以自身判断为唯一护栏。

### 硬性规则

- 不在指定目标之外递归删除或移动；先解析绝对路径。
- 不 `git push`、不 `git reset --hard`、不未经要求改写远程历史。
- 不改 lockfile、不未经要求升级大版本依赖。
- 不弱化、跳过或删除测试来让它通过。
- 未实际运行通过并展示输出前，不得声称检查通过。
- 未证实项与剩余风险要如实披露；隐瞒即失职。

### 工作范围

- 只改任务点名的部分，不做顺手重构或重排。
- 发明新模式前，先读树内不少于 2 个相似模块再对齐。
- 复用已有辅助；仅当没有现成覆盖时才新增依赖。
- 同一错误连续失败 3 次后停下上报：复现、已排除假设、阻塞点。

### Mem0（MCP：`mem0`）

- 凭经验作答前先 `search_memory`；只在 git/代码无法推导的耐用结论上用 `add_memory`；新发现推翻旧条目时改写或删除。

## 文档指针（Pointer）

- 用户手册：`docs/USER_GUIDE.md`
- 项目历史/长期记忆：`docs/PROJECT_HISTORY.md`、`docs/PROJECT_MEMORY.md`
- 功能模块/维护手册：`docs/FUNCTION_MODULES.md`、`docs/MAINTENANCE.md`
- 架构/ADR：`docs/adr/`、`docs/superpowers/specs/`、`docs/superpowers/plans/`
- 完成审计：`docs/verification/`
- 学习/错误/功能记录：`.learnings/`
- 外部知识库：`E:\BaiduSyncdisk\知识库\DNF补丁管理器`

## 任务边界

Ponytail 已由插件 hook 激活，强度以 `/ponytail [lite|full|ultra|off]` 为准。写代码前按"懒惰阶梯"优先复用、少造：先看是否已有、标准库是否覆盖、已装依赖是否解决，再写最小可行代码。Bug 修复做根因而非症状；不过度设计、不预造抽象。

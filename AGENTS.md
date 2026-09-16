<!-- FOR AI AGENTS - Human readability is a side effect, not a goal -->
<!-- Managed by agent: keep sections and order; edit content, not structure -->
<!-- Last updated: 2026-09-16 | Last verified: 2026-09-16 -->

# AGENTS.md

> 本文件面向 AI 代理/维护者，不是给人类用户看的用户手册。人类文档见 `docs/`。

**Precedence:** the closest `AGENTS.md` wins; root only holds global defaults. Explicit user prompts override these files.

## 项目概览

DNF 补丁管理器（`dnf-patch-manager-rewrite`）是一个 Windows 桌面 Electron + React + TypeScript 应用，用于管理用户本地 DNF `.npk` 补丁库。只管理用户已有文件；不做在线下载、社区分发或游戏逻辑修改。

| 项 | 值 |
|----|----|
| 类型 | Electron + React + TypeScript 桌面应用 |
| 包管理器 | pnpm 11.5.2 |
| Node | >= 24 |
| 构建 | electron-vite，产物输出 `out/` |
| 打包 | electron-builder，产物 `dist/`（NSIS 安装包 x64；portable 可选） |
| 测试 | vitest + @testing-library + playwright |
| 代码检查 | biome + tsc |
| CI | GitHub Actions（推送 `v*` 标签时发布） |

## Commands

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
pnpm dist:installer              # 打包 NSIS 安装包（可选安装路径）
pnpm exec install-electron       # 发布/打包前准备 Electron 二进制
pnpm release                     # 构建并发布 GitHub Release（需要 GH_TOKEN）
pnpm verify:portable             # 校验 portable 产物
pnpm verify:packaged             # 校验打包产物
pnpm doctor                      # react-doctor 诊断
```

日常启动：直接双击 `启动DNF补丁管理器.bat`；构建产物齐全时会跳过检查并直接启动。源码更新后可用 `启动DNF补丁管理器.bat --check` 检查并按需构建，或用 `--repair` 强制重建。

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

### Git 与发布

- 默认在 `master` 分支开发和发布；临时分支只在确有隔离需求时创建，清理分支前先列出并得到明确请求。
- 源码仓库与发布物分离：提交 `src/`、配置、测试和必要脚本；不提交 `node_modules/`、`out/`、`dist/`、`data/`、用户补丁库、日志或本地 `.learnings/`。安装包、`latest.yml`、`.blockmap` 只上传到 GitHub Release。
- 只上传源码时不要顺手改写 `README.md` 或其它说明文件；发布附件不是源码文件。
- 发布前保持 `package.json` 的 `version`、`src/shared/contracts.ts` 的 `APP_VERSION`、Git 标签 `vX.Y.Z` 和 Release 中的 `latest.yml` 一致。同一版本的重打包不会触发现有安装的自动更新，修复更新必须递增版本号。
- `pnpm install --frozen-lockfile` 不保证存在 `node_modules/electron/dist`；执行 `pnpm dist:installer` 或 `pnpm release` 前，发布环境必须先运行 `pnpm exec install-electron`。GitHub Actions 的发布流程也必须保留这一步。
- `electron-updater` 从 GitHub Release 的安装包和 `latest.yml` 获取更新，不读取仓库源码；NSIS 更新安装目录必须沿用当前运行程序目录。
- 自动更新只能用已安装的 NSIS 版本验证；源码目录的 `启动DNF补丁管理器.bat` 属于开发模式，不代表真实更新链路可用。更新日志默认来自 `src/shared/contracts.ts`，检测到新版本后才替换为 GitHub Release 说明。
- `pnpm dist:installer` 用于验证 NSIS 安装器（包括可选安装路径）；`pnpm verify:portable` 与 `pnpm verify:packaged` 当前只覆盖 portable 产物，不能据此声称 NSIS 安装路径已验证。

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

## Scoped AGENTS.md（进入对应目录前必须阅读）

| 目录 | 作用 |
|------|------|
| [src/AGENTS.md](./src/AGENTS.md) | 主进程/预加载/渲染进程/core 的边界与依赖方向 |
| [tests/AGENTS.md](./tests/AGENTS.md) | 测试分层、运行方式与断言约定 |
| [.github/workflows/AGENTS.md](./.github/workflows/AGENTS.md) | CI 与发布流水线约束 |

> 进入上述目录修改文件前，必须先读该目录的 `AGENTS.md`；其规则覆盖根文件。

## 任务边界

Ponytail 已由插件 hook 激活，强度以 `/ponytail [lite|full|ultra|off]` 为准。写代码前按"懒惰阶梯"优先复用、少造：先看是否已有、标准库是否覆盖、已装依赖是否解决，再写最小可行代码。Bug 修复做根因而非症状；不过度设计、不预造抽象。

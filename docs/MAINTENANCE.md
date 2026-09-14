# DNF 补丁管理器维护与迭代手册

## 维护入口

当前权威仓库：`E:\codex目录\DNF`

知识库目录：`E:\BaiduSyncdisk\知识库\DNF补丁管理器`。这里只存固定的 1 个 YAML 配置和 4 个 Markdown 知识文件，不是源码仓库。

分支策略：本地只保留 `master`，不使用远端作为本地验证前提。每次维护先确认：

```powershell
rtk git status --short --branch
rtk git branch --all
rtk git log -1 --oneline
```

## 架构边界

```text
Electron main
  -> core filesystem/state/application services
  -> typed IPC handlers
  -> preload validation and named API
  -> React renderer/workspace/components/styles
```

- `src/main`：窗口、路径、IPC 注册、系统对话框和受管资源协议。
- `src/core`：路径安全、扫描、分类、组、导入、移动、回收、安装、预览、壁纸和状态。
- `src/core/presets`：预设原子状态、库内 NPK 引用校验、缺失解析和叠加安装编排。
- `src/shared`：Zod 请求模型、DTO、API 和结果类型。
- `src/preload`：只暴露命名 API，不暴露 `ipcRenderer`、Node `fs` 或通用 invoke。
- `src/renderer`：选择、筛选、视图、命令、对话框和样式；不直接读写磁盘。
- `tests/integration`：真实临时目录和事务不变量。
- `tests/e2e`：真实 Electron 窗口和用户工作流。

## 状态和文件布局

开发版和 portable 版都通过 `app-paths.ts` 计算根目录。portable 版使用 EXE 同级目录：

```text
data/
  settings.json
  installation-state.json
  category-order.json
  recycle-bin.json
  previews.json
  wallpapers.json
  presets.json
  recycle-bin/
  previews/
  wallpapers/
  transaction-recovery/
patch-categories/
```

所有 JSON 使用同目录临时文件、写入、`sync` 和原子替换；读取损坏不能静默当成空状态。

## 修改前的检查点

1. 先读对应 service、IPC handler、preload contract 和现有测试。
2. 明确成功标准：真实文件结果、状态 JSON、界面状态和错误行为。
3. 先写能因缺失行为失败的测试，再实现最小改动。
4. 多文件操作必须通过 `executeFileTransaction`，提供补偿动作和必要路径信息。
5. 状态文件写入失败时旧字节必须保留，临时文件必须清理。
6. UI 改动必须有渲染测试或真实 Electron 截图/E2E 证据。

## 验证门禁

```powershell
rtk pnpm lint
rtk pnpm typecheck
rtk pnpm vitest run --maxWorkers=2
rtk pnpm build
rtk pnpm exec playwright test
rtk pnpm exec playwright test tests/e2e/presets.e2e.ts
rtk pnpm verify:portable
rtk pnpm verify:packaged
rtk cmd /c "启动DNF补丁管理器.bat --check"
```

声明完成前必须看到全部命令的实际成功输出；不能用“代码看起来正确”代替真实 Electron 验证。

## Git 和部署流程

1. 在 `master` 上确认工作树状态。
2. 只修改与任务直接相关的文件；用户 NPK、壁纸、`data`、`dist`、`out`、`node_modules` 和截图不提交。
3. Git 写操作串行执行：`add` -> `diff --cached --check` -> `commit`。
4. 提交后再次检查 `git status --short --branch` 和分支列表。
5. 分支合并后必须验证预期分支 head 已进入目标分支：`git merge-base --is-ancestor <branch> master`，并检查 merge commit 的 parents；然后跑受影响的 UI/E2E。
6. 发布 portable 前在英文临时目录打包，检查 EXE 同级 `data`/`patch-categories`，确认 AppData 不写入旧路径。
7. 只同步知识库固定五文件到 `E:\BaiduSyncdisk\知识库\DNF补丁管理器`；源码、Git、依赖、运行数据和构建产物留在代码工作副本。

## 已验证的高风险陷阱

- 嵌套 `.git` 会被外层仓库记录成 gitlink；初始化或搬迁前必须检查 `.git`。
- BAT 只检查 Electron npm 包目录不够；还要确认 `node_modules\electron\dist\electron.exe` 存在，必要时执行 `pnpm exec electron --version` 下载二进制。
- Windows PowerShell 不是 Bash；不要依赖 `&&`，也不要让外层 shell 展开 PowerShell 的 `$LASTEXITCODE`。
- PowerShell 终端中文显示可能乱码；以 UTF-8 文件读取、真实 UI 和 JSON 结果为准。
- 中文路径下打包更容易掩盖 Electron Builder 问题，portable 门禁使用英文临时路径。
- 删除被同步/杀毒组件持有的目录时，先确认内容为空，再使用 Windows 延迟删除，避免误杀无关进程。
- 同一仓库的 Git 写操作不能并行，否则会产生 `index.lock` 竞争。
- 预设只引用补丁库相对路径；安装必须复用批量启用服务并保留其它启用记录，缺失引用不能被当成空预设。
- 资源社区当前是本地“待构建”占位，不应在 renderer 或 IPC 中引入远端请求。

## 迭代记录方法

- 新功能：先写 `.learnings/功能需求.md`，确定是否符合“不做”边界。
- 用户纠正或非显然经验：写 `.learnings/学习记录.md`，解决后标记 `resolved`，可推广规则再更新本手册。
- 命令失败、启动错误和回归：写 `.learnings/错误记录.md`，记录复现、根因、修复、验证和提交。
- 阶段性总结：更新 `docs/PROJECT_HISTORY.md`，不要把所有过程继续堆到一个长日志。
- 长期提炼：更新 `docs/知识库_项目沉淀总览.md`，把项目历史、模块职责和用户操作合并维护，避免知识库出现大量分散文档。

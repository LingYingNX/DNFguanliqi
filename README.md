# DNF 补丁管理器

Windows 本地 DNF `.npk` 补丁管理工作台。项目只管理用户已有文件，不提供在线下载、社区分发或游戏逻辑修改。

## 快速开始

双击 [启动DNF补丁管理器.bat](./启动DNF补丁管理器.bat)。启动器会检查并安装 pnpm 依赖、补齐 Electron 运行时、构建缺失的 `out`，再启动桌面界面。

维护者入口：

- [用户操作手册](./docs/USER_GUIDE.md)
- [项目历史](./docs/PROJECT_HISTORY.md)
- [长期项目记忆](./docs/PROJECT_MEMORY.md)
- [功能模块说明](./docs/FUNCTION_MODULES.md)
- [维护与迭代手册](./docs/MAINTENANCE.md)
- [完成审计](./docs/verification/2026-07-19-completion-audit.md)
- [学习记录](./.learnings/学习记录.md)
- [错误记录](./.learnings/错误记录.md)
- [功能需求](./.learnings/功能需求.md)

## 常用命令

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm typecheck
pnpm vitest run --maxWorkers=2
pnpm exec playwright test
pnpm verify:portable
pnpm verify:packaged
```

最终知识库目录：`E:\BaiduSyncdisk\知识库\DNF补丁管理器`。该目录固定只保存 `mempalace.yaml`、`错误记录.md`、`功能请求.md`、`学习记录.md` 和 `知识库_项目沉淀总览.md`；源码、Git、依赖、运行数据和启动脚本都留在本仓库。

# 最终知识库部署验证

日期：2026-07-21

## 目标

最终交付目录：`E:\BaiduSyncdisk\知识库\DNF补丁管理器`

源代码工作副本为 `E:\codex目录\DNF`；知识库目录只保存指定的五个根文件，不是 Git 仓库，也不包含软件源码。

## 部署内容

- `mempalace.yaml`。
- `错误记录.md`、`功能请求.md`、`学习记录.md`。
- `知识库_项目沉淀总览.md`：合并项目历史、功能模块、使用方法和维护规则。
- 目标目录不放源码、Git、依赖、运行数据、构建输出、NPK、壁纸、启动脚本或子目录。

## 源码工作副本验证

- `pnpm install --frozen-lockfile`：通过。
- `pnpm build`：通过。
- `启动DNF补丁管理器.bat --check`：通过，并自动补齐缺失的 Electron 二进制。
- 真实启动：窗口标题为 `DNF 补丁管理器`。
- 关闭验证进程后无残留 Electron 进程。
- Git：源码工作副本仅保留 `master`，工作树干净。

## 知识库目录验证

- 最终文件数量：5，其中 1 个 YAML 和 4 个 Markdown。
- 文件名固定为：`mempalace.yaml`、`错误记录.md`、`功能请求.md`、`学习记录.md`、`知识库_项目沉淀总览.md`。
- 目标目录只有五个根文件，没有子目录。
- 目标目录没有 `.git`、`src`、`tests`、`node_modules`、`out`、`data` 或 `dist`。

## 当前代码验证基线

- Biome：156 个文件通过。
- TypeScript：无错误。
- Vitest：44 个文件、182 项测试通过。
- Electron Playwright：此前完成审计为 9/9。

## 后续维护入口

知识库使用时先读 `知识库_项目沉淀总览.md`；错误、新需求和经验分别追加到 `错误记录.md`、`功能请求.md` 和 `学习记录.md`。源码维护时再回到源码仓库的 `README.md`、`docs/USER_GUIDE.md` 和 `docs/MAINTENANCE.md`。

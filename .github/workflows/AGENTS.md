<!-- Managed by agent: keep sections and order; edit content, not structure. Last updated: 2026-09-16 -->

# AGENTS.md — .github/workflows

## Overview

三条流水线：`release.yml`（推送 `v*` 标签时构建并发布 GitHub Release）、`harness-verify.yml`（master 的 push/PR 上校验 AGENTS.md harness 一致性）、`no-duplicate-helpers.yml`（master 的 push/PR 上拒绝重复的路径/状态辅助实现）。

## Key Files

| 文件 | 作用 |
|------|------|
| `release.yml` | windows-latest 上校验 tag 与版本一致，安装 Electron 二进制后 `pnpm run release` |
| `harness-verify.yml` | ubuntu-latest 上运行 `bash scripts/verify-harness.sh` |
| `no-duplicate-helpers.yml` | ubuntu-latest 上运行 `node scripts/check-path-helpers.mjs`，与 `.githooks/pre-commit` 同源 |

## Workflow files

- 发布必须保留 `pnpm exec install-electron` 步骤；`pnpm install --frozen-lockfile` 不保证存在 `node_modules/electron/dist`。
- 发布前保证 `package.json` version、`APP_VERSION`、Git 标签 `vX.Y.Z` 四者一致。
- 同一版本重打包不会触发已有安装的自动更新；修复更新必须递增版本号。

## Build & tests

本地等价校验：

```powershell
bash scripts/verify-harness.sh
pnpm typecheck
pnpm test
```

## Code style & conventions

- 权限最小化：默认 `contents: read`，仅发布任务使用 `contents: write`。
- 步骤名用祈使句，job id 用 kebab-case。
- 不引入 `secrets: inherit`。

## Security & safety

- 不在日志中输出令牌或密钥。
- 发布凭据只通过 GitHub Secrets 注入。

## PR/commit checklist

- [ ] 流水线 YAML 语法有效
- [ ] 版本校验步骤保留
- [ ] 权限块未被放宽

## Patterns to Follow

> 对齐现有 `release.yml` 的 pnpm/Node 版本与缓存配置，不要另起一套。

## When stuck

- 参考 GitHub Actions 文档与仓库内现有工作流。
- harness 失败时先本地跑 `bash scripts/verify-harness.sh` 复现。

## House Rules (project-specific)

- `harness-verify.yml` 只校验文档 harness，不要往里塞构建逻辑。
- 新增工作流或改动现有 workflow 后，同步更新本文件的 Overview 与 Key Files：`verify-harness.sh` 的 drift 检查只比对根 `AGENTS.md`，不会提醒 scoped 文件过期。
- 重复辅助守卫（`no-duplicate-helpers.yml`）的规则与例外定义在 `scripts/check-path-helpers.mjs`；调整允许清单时同步更新其回归测试 `tests/unit/check-path-helpers.test.ts` 与 `src/AGENTS.md` 的对照表。

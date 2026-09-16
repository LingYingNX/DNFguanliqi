<!-- Managed by agent: keep sections and order; edit content, not structure. Last updated: 2026-09-16 -->

# AGENTS.md — src

## Overview

Electron 主进程、预加载桥、渲染进程 React UI 与共享类型。生产代码不得反向依赖 `tests/`。

## Key Files

| 路径 | 职责 |
|------|------|
| `src/main/` | Electron 窗口、生命周期、`ipc/` 处理器、资源协议 |
| `src/preload/` | `contextBridge` 暴露给渲染进程的 `DnfApi` |
| `src/renderer/` | React 界面（`components/`、`styles/`、`workspace/`） |
| `src/core/` | 按业务域拆分的逻辑，不得依赖 renderer 组件 |
| `src/shared/` | 主进程/渲染进程共享契约与 schema |

## Setup & environment

- Node >= 24，包管理器 pnpm 11.5.2。
- 路径含中文与空格，脚本与文档中始终使用 `-LiteralPath`。

## Build & tests

```powershell
pnpm typecheck
pnpm lint
pnpm vitest run tests/renderer/<name>.test.tsx
pnpm build
```

## Code style & conventions

- TypeScript strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`；不要用 `any` 或非空断言。
- Biome 是唯一格式化/检查入口，禁止手工调整格式对抗它。
- React 组件使用函数组件与 `React.JSX.Element` 返回类型；只读 props 用 `readonly`。
- 渲染进程不得直接 `import` Electron；所有原生能力走 preload 暴露的 API。
- 复用 `src/shared/` 已有契约与 `src/core/` 已有服务，不新增重复抽象。
- 新增行为必须补对应测试，不弱化或删除既有断言。

## Security & safety

- IPC 请求必须先过 schema 校验，再触达文件系统。
- 破坏性文件操作必须在解析后的绝对路径内，且遵守事务/回收站约束。
- 不在渲染进程暴露文件系统路径或凭据。

## PR/commit checklist

- [ ] `pnpm typecheck` 通过
- [ ] `pnpm exec biome check <改动文件>` 通过
- [ ] 相关测试通过，并附命令输出
- [ ] 未改动与任务无关的模块

## Patterns to Follow

> 优先参考仓库内真实实现，不要照搬通用模板。

## When stuck

- 先读 `docs/ARCHITECTURE.md` 与 `docs/FUNCTION_MODULES.md`。
- 再读同域至少 2 个相似模块，对齐后再动手。

## House Rules (project-specific)

- 改 `src/shared/contracts.ts` 的 `APP_VERSION` 时，必须同步 `package.json` 版本与 Git 标签。
- 外观相关 CSS 变量由 `src/renderer/workspace/useAppearance.ts` 统一写入，不要在组件里另起变量名。

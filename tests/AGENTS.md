<!-- Managed by agent: keep sections and order; edit content, not structure. Last updated: 2026-09-16 -->

# AGENTS.md — tests

## Overview

测试按层拆分：`unit/` 走默认 jsdom 配置、`integration/` 走 node 配置与真实 core 服务、`renderer/` 在 jsdom 下用 Testing Library、`e2e/` 用 Playwright。

## Key Files

| 路径 | 用途 |
|------|------|
| `tests/unit/` | 纯函数与契约（node） |
| `tests/integration/` | core 服务与 IPC 契约集成（node） |
| `tests/renderer/` | React 组件与工作区行为（jsdom） |
| `tests/e2e/` | 打包后应用端到端（Playwright） |
| `tests/renderer/fake-api.ts` | 渲染层测试用的假 `DnfApi`，改契约需同步 |

## Setup & environment

- `vitest.config.ts`（含 `tests/unit`、`tests/renderer`）为 jsdom；`vitest.integration.config.ts` 为 node。
- `clearMocks` 与 `restoreMocks` 已开启；测试间不得共享可变状态。
- 涉及中文路径/文件的用例必须用真实路径写法，不要硬编码盘符假设。

## Running tests

```powershell
pnpm test
pnpm test:unit
pnpm test:integration
pnpm vitest run tests/renderer/<name>.test.tsx
pnpm test:e2e
```

## Test organization

- 文件名与被测对象对应：`<feature>.test.ts` / `<component>.test.tsx`。
- 断言用户可见行为，不锁内部实现细节。
- 外部依赖（网络、文件系统、时间）必须 mock 或隔离。
- 回归测试要能在这个 bug 上变红，修复后变绿。

## Code style & conventions

- 测试名描述期望行为，不写 `should work`。
- 优先 `screen.getByRole` 等语义查询，少用 test id。
- 时间相关行为用 fake timers，并确保恢复真实计时器。

## Security & safety

- 不在 fixture 中写真实凭据、令牌或用户数据。
- 不写入用户真实补丁库路径；测试使用临时目录。

## PR/commit checklist

- [ ] 目标测试通过并附输出
- [ ] 新行为有对应断言
- [ ] 无遗留 `[DEBUG-*]` 调试代码

## Patterns to Follow

> 参考 `tests/renderer/appearance-settings.test.tsx` 与 `tests/integration/category-style.test.ts` 的现有写法。

## When stuck

- 先确认 config 选对了环境（jsdom 还是 node）。
- 再确认是否漏了 `fake-api.ts` 的契约同步。

## House Rules (project-specific)

- 修改 `DnfApi` 契约后，必须同步 `tests/renderer/fake-api.ts`。
- 不要用 `pnpm lint` 的全量结果掩盖单文件问题；针对性跑 `biome check <文件>`。

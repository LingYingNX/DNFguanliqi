# DNF 补丁管理器重写完成审计

日期：2026-07-19

## 范围与来源边界

- 交付仓库为 `E:\codex目录\DNF`，分支为 `master`。
- 实现使用 Electron、React 和严格 TypeScript，从设计契约与可观察功能重写；未复制旧程序源码。
- `前端/` 仅作为已提供的视觉和交互参考保留。
- 用户提供的 NPK 与 `[wi0a] 91489374.png` 只用于本地真实输入测试，均被 Git 忽略。
- 未配置或访问 Git 远端。

## 功能证据

| 要求 | 当前证据 |
| --- | --- |
| 真实库扫描 | `scanner.test.ts` 覆盖分类、NPK、组标记、直接计数与递归作用域。 |
| 导入和冲突 | `import-patches.test.ts` 覆盖 NPK 限制、重复内容与同名冲突；Electron 工作流覆盖文件选择导入。 |
| 分类 | 分类创建、重命名、删除、父级内排序由集成、渲染与 Electron 测试覆盖。 |
| 补丁组 | 真实目录和 `.dnf-group.json`，支持打组、移动、重命名、启停、回收与恢复。 |
| 选择和浏览 | Ctrl/Shift/框选、搜索、启用筛选、直接/递归作用域、网格/列表和卡片尺寸均有渲染或 E2E 覆盖。 |
| 游戏目录 | 选择结果持久化；重启后仍可启停真实 NPK；目标路径受游戏根边界保护。 |
| 启用和停用 | 单项、批量和组采用预检加事务；冲突和外部修改不会覆盖或删除目标。 |
| 移动和重命名 | 库文件、游戏文件、安装记录和预览绑定在同一生命周期事务中迁移。 |
| 回收站 | 完整移动、恢复冲突保护、预览绑定恢复和显式清空确认均有测试。 |
| 预览 | 受管图片复制、协议解析、选择及移动/回收/恢复生命周期均有测试。 |
| 外观和壁纸 | 两套主题、五个槽、导入/切换/删除和全部显示参数；用户壁纸在三个视口真实渲染。 |
| 检查器 | 支持折叠/展开，按钮使用 Lucide 图标；只读模式禁用修改命令。 |
| 状态恢复 | 启动检查所有 JSON；损坏时显示持久提示、保留原字节并全局拒绝修改 IPC。 |
| 原子状态 | 同目录临时文件、刷新、替换；替换失败测试证明旧字节不变且临时文件被清理。 |
| 事务恢复 | 补偿失败写入 `data/transaction-recovery/*.json`；API 错误显示受影响路径和日志路径。 |
| 桌面安全边界 | 渲染层只使用类型化 preload API；路径输入由 Zod 和根目录边界解析。 |

## 运行与打包证据

- `pnpm lint`：Biome 检查 156 个文件，通过。
- `pnpm typecheck`：TypeScript 无错误。
- `pnpm vitest run --maxWorkers=2`：44 个文件、182 项测试通过。
- `pnpm build`：main、preload 和 renderer 生产构建通过。
- `pnpm exec playwright test`：真实 Electron 9/9 通过。
- `pnpm verify:portable`：在英文临时目录重新安装、构建并生成 portable EXE，通过。
- `pnpm verify:packaged`：打包程序启动、窗口、同级补丁扫描、同级数据和 AppData 隔离，通过。
- 项目内与上级 `启动DNF补丁管理器.bat --check` 均通过，能定位实际 Electron 运行时。
- 验证结束后无残留 `electron.exe` 进程。

## 交付物

- Portable：`dist\DNF补丁管理器-1.1.0-portable.exe`
- 大小：`91,134,501` 字节
- SHA-256：`e6dbe4d338567be9e9aa4f8f5cc37851f203383b21ef4e48e6e90146158fbe89`
- 项目启动器：`启动DNF补丁管理器.bat`
- 上级便捷启动器：`E:\codex目录\DNF\启动DNF补丁管理器.bat`

## 仓库卫生

- `node_modules/`、`out/`、`dist/`、运行数据、测试报告、`.scratch/`、本地 NPK、用户壁纸和中间 PNG 不进入提交。
- 生产 TypeScript、TSX 和 MJS 文件均不超过 250 行。
- 两个此前提交的测试文件超过 250 行：`library-lifecycle-service.test.ts` 和 `operations.test.tsx`。本次不为纯行数重排既有测试；新增和本轮修改的测试文件均在限制内。
- `git diff --check` 通过。

## 已知非阻塞提示

- electron-builder 报告 `package.json` 缺少 `author`，不影响构建或运行；未添加无需求依据的作者元数据。
- Portable EXE 未使用用户证书签名；electron-builder 的资源签名步骤完成，但不等同于可信发布证书。

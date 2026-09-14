# DNF 补丁管理器功能模块说明

更新时间：2026-07-22

本文把用户能操作的功能、源码模块、持久化数据和验证入口对应起来。修改功能时先定位所属模块，再阅读该模块的 service、IPC contract、preload API 和测试。

## 一、用户功能总览

| 功能模块 | 用户能做什么 | 主要事实来源 |
| --- | --- | --- |
| 补丁库扫描 | 查看真实分类、NPK、组、大小、时间和启用状态 | `src/core/library/scanner.ts`、`tests/integration/scanner.test.ts` |
| 分类管理 | 创建、重命名、删除、同级排序、递归查看 | `category-commands.ts`、`category-order-service.ts`、`CategoryTree.tsx` |
| 导入 | 拖放导入 `.npk`，预检重复和冲突 | `import-patches.ts`、`category-transfer-ipc.ts` |
| 移动和重命名 | 单项或批量移动、改名、跨分类移动 | `move-library-item(s).ts`、`library-lifecycle-service.ts` |
| 真实文件夹组 | 把多个 NPK 放进真实组目录，整体管理 | `library-commands.ts`、`group-marker.ts` |
| 选择和视图 | 单选、多选、连续选择、框选、搜索、启用筛选、网格/列表 | `useItemSelection.ts`、`ItemWorkspace.tsx` |
| 侧栏导航 | 回收站、全部、未分类、预设、资源社区和真实分类树 | `NavigationSelection`、`CategorySidebar.tsx`、`useWorkspace.ts` |
| 本地预设 | 从选中 NPK 创建或追加，查看缺失引用、重命名、删除和叠加安装 | `preset-service.ts`、`PresetWorkspace.tsx`、`usePresets.ts` |
| 游戏安装 | 绑定游戏目录，单项、批量或组启用/停用 | `src/core/install`、`game-directory-ipc.ts` |
| 回收站 | 删除到回收站、查看、恢复、清空确认 | `src/core/recycle`、`RecycleBinDialog.tsx` |
| 项目预览 | 给 NPK 或组选择和维护预览图；NPK 预览使用同目录同名图片 | `src/core/library/library-preview.ts`、`src/core/previews`、`preview-ipc.ts` |
| 壁纸与外观 | 五个壁纸槽位、主题、颜色、显示参数 | `src/core/wallpapers`、`src/core/appearance` |
| 损坏恢复 | 读取损坏状态时进入只读恢复模式 | `recovery-mode.ts`、`recovery-contracts.ts` |
| 便携发布 | 在 Windows x64 portable EXE 中运行并保留同级数据 | `app-paths.ts`、`scripts/verify-portable.mjs` |

## 二、核心领域模块

### 1. 补丁库和分类

- `src/core/paths/library-path.ts`：将用户输入的相对路径解析到 `patch-categories`，拒绝越界路径。
- `src/core/library/scanner.ts`：扫描当前分类、本层 NPK、组目录和子分类树；父分类默认不混入子目录内容。
- `src/core/library/category-commands.ts`：创建、重命名和删除分类，删除前要求目录为空。
- `src/core/library/category-order-service.ts`：持久化同级分类顺序到 `data/category-order.json`。
- `src/shared/library-dto.ts`：定义补丁、组、分类树和快照 DTO，供 IPC 和 renderer 共用。

用户规则：分类是现实文件夹，不是只存在于界面或 JSON 的标签。排序、删除和递归显示都必须与真实目录结果一致。

### 2. 导入、移动、重命名和组

- `src/core/library/import-patches.ts`：只接受 `.npk`，先检查同路径、同内容和同名不同内容，再执行复制。
- `src/core/library/move-library-item.ts`、`move-library-items.ts`：提供单项和批量移动计划，批量失败时逆序补偿。
- `src/core/library/library-commands.ts`：处理组创建、组名解析和组内项目命令。
- `src/core/library/group-marker.ts`：用 `.dnf-group.json` 标识真实组目录，并读取组身份。
- `src/core/application/library-lifecycle-service.ts`：把移动、回收和预览绑定迁移组合成一个生命周期事务。

组不是虚拟集合。创建组会创建真实目录并移动 NPK；组可以继续移动、重命名、启停、回收和恢复。

### 3. 本地预设

- `src/core/presets/preset-state.ts`：使用原子 JSON 存储维护 `data/presets.json`。
- `src/core/presets/preset-service.ts`：校验名称唯一性、NPK 引用路径、重复引用和缺失项；安装时只把现存引用交给批量启用服务。
- `src/shared/preset-contracts.ts`：定义预设 DTO、创建/追加/重命名/删除/安装请求和缺失结果。
- `src/main/ipc/preset-ipc.ts`：注册 `presets:list/create/rename/delete/add-items/install` typed IPC，并复用游戏目录安装服务和修改互斥锁。

预设不复制 NPK，也不代表真实文件夹。安装是叠加操作，不停用预设之外的启用项；缺失引用保留在预设中并在列表和安装结果中报告。

### 4. 游戏目录绑定和安装生命周期

- `src/core/appearance/appearance-settings.ts`：读取和更新持久化游戏目录绑定。
- `src/core/install/install-target-boundary.ts`：确认目标路径确实位于用户选择的游戏根目录边界内。
- `src/core/install/install-sources.ts`：解析补丁或组内 NPK 为安装源。
- `src/core/install/enable-install-items.ts`：复制 NPK 到游戏目录，记录源路径、目标路径和哈希。
- `src/core/install/disable-install-items.ts`：只删除仍与记录哈希匹配的文件，遇到外部修改或冲突就停止。
- `src/core/install/install-service.ts`：统一单项、批量、组启停命令。
- `src/core/install/relocate-installation.ts`：游戏目录变更时规划和执行安装迁移。
- `src/core/install/installation-state.ts`、`installation-records.ts`：保存安装状态和按项目查询记录。

启用不是简单复制，停用也不是无条件删除。目标文件保护和状态记录是这个模块的安全边界。

### 5. 回收站和恢复

- `src/core/recycle/recycle-service.ts`：提供回收、恢复、清空和批量生命周期。
- `recycle-items.ts`：为每个项目生成源路径、回收路径和补偿步骤。
- `recycle-manifest.ts`：持久化 `data/recycle-bin.json`。
- `src/renderer/components/RecycleBinDialog.tsx`：展示原路径、时间、类型和恢复操作。

删除默认是移动到 `data/recycle-bin`，恢复先检查目标是否冲突；清空回收站必须显式确认且不可由应用恢复。

### 6. 预览图、受管图片和壁纸

- `src/core/library/library-preview.ts`：复制、识别和读取与 NPK 同目录同基础名的预览图，并生成 `dnf-library:` URL。
- `src/core/assets/managed-image-assets.ts`：保存组预览和壁纸等受管资源，并生成 `dnf-asset:` URL。
- `src/core/previews/preview-service.ts`、`preview-state.ts`：保存组预览绑定，并在启动时将旧版 NPK 受管预览迁移为同目录同名图片。
- `src/core/wallpapers/wallpaper-service.ts`、`wallpaper-state.ts`：维护五个壁纸槽位和当前激活槽位。
- `src/core/appearance/appearance-settings.ts`：保存主题、色温、饱和度、对比度、缩放、透明度和位置。
- `src/main/managed-asset-protocol.ts`：在 Electron 主进程中安全解析受管资源 URL。

用户入口已经定案为双击预览区域选择图片；右键菜单不提供“选择预览图”。

### 7. 状态、事务和恢复

- `src/core/state/schemas.ts`：用 Zod 定义设置、安装、回收、预览、壁纸和分类排序状态。
- `src/core/state/atomic-json-store.ts`：使用临时文件、写入、同步和原子替换保存 JSON；旧内容在失败时保留。
- `src/core/filesystem/file-transaction.ts`：执行多步文件操作，记录补偿动作并支持恢复日志。
- `src/core/filesystem/hash-file.ts`：计算安装保护所需的内容哈希。
- `src/core/concurrency/async-mutex.ts`：串行化会修改同一份状态的操作。
- `src/main/ipc/recovery-mode.ts`：检测损坏状态或未完成事务，返回只读恢复状态。

核心不变量是：先预检，后执行；所有步骤成功才提交状态；失败时逆序补偿；不能把损坏状态静默当成空状态。

## 三、桌面应用边界

### Main、IPC 和 preload

- `src/main/main.ts`：创建窗口，计算运行路径，初始化服务和恢复模式。
- `src/main/register-ipc.ts` 及 `src/main/ipc/*.ts`：把分类、导入、移动、安装、回收、预览、外观和恢复服务注册为命名 IPC 通道。
- `src/main/ipc/validated-handler.ts`：在进入领域 service 前验证未知输入。
- `src/main/ipc/api-result.ts`：把领域错误转换为稳定的 `{ ok, value/error }` API 结果。
- `src/preload/preload.ts`：通过 `contextBridge` 暴露白名单 API，renderer 只能调用已命名契约。
- `src/shared/ipc-contracts.ts`、`appearance-contracts.ts`、`preview-contracts.ts`、`recovery-contracts.ts`：定义输入、输出和路径安全约束。

### Renderer 工作台

- `src/renderer/components/WorkspaceApp.tsx`、`WorkspaceApp`：组合主工作区、系统导航和数据刷新。
- `CategorySidebar.tsx`、`CategoryTree.tsx`：系统入口、分类树、递归切换和拖拽排序。
- `ItemWorkspace.tsx`：补丁/组卡片、列表、搜索、视图切换、选择和主工作区选中操作条。
- `PresetWorkspace.tsx`、`PresetDialogs.tsx`：预设列表、引用详情、创建/追加、重命名和删除。
- `CategoryDialogs.tsx`、`OperationDialogs.tsx`、`RecycleBinDialog.tsx`、`SettingsDialog.tsx`：分类、移动、打组、回收、恢复、壁纸和外观对话框。
- `src/renderer/workspace/*.ts`：把选择、分类命令、操作命令、游戏目录、外观和恢复状态从展示组件中分离。

Renderer 不直接读写磁盘；遇到异常时展示 API 错误和恢复状态，而不是自行猜测文件结果。

## 四、数据布局

便携版 EXE 同级目录使用以下布局：

```text
DNF补丁管理器.exe
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
  <真实分类目录>/<NPK 或组目录>
```

用户数据升级前备份 `data` 和 `patch-categories`。NPK、壁纸和运行数据属于用户数据，不复制到知识库，也不提交 Git。

## 五、验证入口

| 风险 | 首选验证 |
| --- | --- |
| 路径越界、扫描和真实目录 | `tests/integration` 临时目录测试 |
| 状态原子性、回滚和恢复 | `atomic-json-store`、`transaction-recovery`、`recovery-mode` 集成测试 |
| UI 选择、分类、视图和对话框 | `tests/renderer` |
| 导航、预设创建/追加/安装和缺失引用 | `tests/renderer/navigation.test.tsx`、`tests/renderer/preset-workspace.test.tsx` |
| 真实 Electron 工作流 | `tests/e2e` 和 Playwright |
| 启动、portable、packaged | `启动DNF补丁管理器.bat --check`、`pnpm verify:portable`、`pnpm verify:packaged` |

任何新文件操作都要同时验证磁盘树、状态 JSON 和界面结果；任何 UI 改动都要保留渲染测试或真实 Electron 证据。

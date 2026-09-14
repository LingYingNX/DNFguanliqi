# DNF 补丁管理器设计系统

## 0. Research Log

- 静态视觉参考：完整读取并检查 `前端/DESIGN.md`、`前端/css/system.css`、HTML 展示页及两张桌面截图；Halo 是本应用的参考合同。
- 参考提炼：保留三层近黑表面、1px 几何边界、靛蓝操作光和单义状态色；舍弃营销页结构、统计图表语义和装饰性标签。
- Lazyweb：跳过，用户已提供完整、可检查的本地参考，外部产品屏幕不会提高契约确定性。
- Imagen：跳过，用户已提供两张清晰的静态参考和完整设计资产，不需要生成替代稿。

## 1. Atmosphere & Identity

这是一个安静、精确、可以长时间重复操作的本地文件工作台。界面退到背景，真实补丁、目录关系和启用状态成为视觉焦点。识别性来自“沿边缘发光的操作轨道”：静止表面由细边框划分，只有当前选择、可执行命令和状态变化获得靛蓝或语义色光线。

主要用户是使用鼠标和键盘维护大量本地 NPK 的单人玩家。关键情境包括中文长路径、大量同类文件、重复启停、冲突恢复以及需要确认真实磁盘结果的高风险操作。工作流优先级为可预测、可扫描、可撤销，然后才是装饰。

## 2. Color

### Palette

| Role | Token | Value | Usage |
|---|---|---:|---|
| Canvas | `--color-canvas` | `#0A0B0F` | 窗口背景、中央工作区 |
| Surface | `--color-surface` | `#14151C` | 工具栏、侧栏、输入、项目卡片 |
| Elevated | `--color-elevated` | `#1E2029` | 选中项、菜单、对话框、悬停表面 |
| Border | `--color-border` | `#2A2D38` | 默认 1px 分隔线 |
| Border strong | `--color-border-strong` | `#3A3D4A` | 输入、活动项、强调边界 |
| Text primary | `--color-text-primary` | `#F2F4F8` | 标题和主要正文 |
| Text secondary | `--color-text-secondary` | `#9AA0AE` | 描述、元数据 |
| Text tertiary | `--color-text-tertiary` | `#5C6170` | 占位、禁用、辅助标签 |
| Primary | `--color-primary` | `#5B6BFF` | 主命令、焦点、选择 |
| Primary hover | `--color-primary-hover` | `#7886FF` | 悬停和高亮文本 |
| Primary pressed | `--color-primary-pressed` | `#4A59E6` | 按下状态 |
| Success | `--color-success` | `#2BE08C` | 已启用、完成 |
| Warning | `--color-warning` | `#F5D547` | 冲突提醒、需确认 |
| Info | `--color-info` | `#3DD7E5` | 中性信息、拖放目标 |
| Error | `--color-error` | `#FF3A5C` | 失败、危险命令 |
| Focus | `--color-focus` | `rgba(91, 107, 255, 0.35)` | 3px 焦点环 |
| Scrim | `--color-scrim` | `rgba(4, 5, 8, 0.76)` | 模态遮罩、壁纸可读性层 |

### Rules

- 颜色表达信息，不作为随机装饰。靛蓝只用于交互和焦点。
- 状态色必须配合图标或文字，不单独依赖颜色。
- 壁纸位于 scrim 之后，主要文字对比度不得因壁纸改变。
- 新颜色必须先进入本表；组件 CSS 不出现孤立颜色值。

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|---|---:|---:|---:|---:|---|
| Window title | 15px | 650 | 1.2 | 0 | 品牌标题 |
| Page title | 20px | 650 | 1.25 | 0 | 当前分类、对话框标题 |
| Section title | 16px | 600 | 1.3 | 0 | 检查器、设置分区 |
| Item title | 14px | 600 | 1.35 | 0 | 补丁、组名称 |
| Body | 14px | 400 | 1.5 | 0 | 默认正文 |
| Body small | 13px | 400 | 1.45 | 0 | 描述和元数据 |
| Caption | 12px | 500 | 1.35 | 0 | 计数、时间、状态 |
| Overline | 11px | 600 | 1.25 | 0 | 工作区路径、分区标签 |
| Mono | 12px | 500 | 1.4 | 0 | 版本、大小、哈希摘要 |

### Font Stack

- Primary: `"Segoe UI Variable", "Segoe UI", system-ui, sans-serif`
- Mono: `"Cascadia Mono", Consolas, monospace`

### Rules

- 不按视口宽度缩放字号；紧凑工作台使用稳定尺寸。
- 所有 letter-spacing 为 `0`。
- 正文不小于 13px，主要命令不小于 14px。
- 长文件名允许两行并在其后省略；完整名称由 tooltip 和检查器提供。

## 4. Spacing & Layout

### Base Unit

所有空间值来自 4px 基础单位。

| Token | Value | Usage |
|---|---:|---|
| `--space-1` | 4px | 图标内部距离 |
| `--space-2` | 8px | 紧凑控件间距 |
| `--space-3` | 12px | 输入和列表内边距 |
| `--space-4` | 16px | 工具栏组、卡片内边距 |
| `--space-5` | 20px | 面板内容间距 |
| `--space-6` | 24px | 工作区边距 |
| `--space-8` | 32px | 空状态和大分组 |

### Stable Dimensions

- 工具栏：56px 高。
- 分类栏：232px，最小 208px，最大 280px。
- 检查器：280px，最小 256px，最大 340px；可收起。
- 图标按钮：36px；紧凑按钮：28px。
- 列表行：48px；网格卡片使用 `minmax(176px, 1fr)` 和稳定预览比例 `4 / 3`。
- 最小窗口：1080x720；目标验收视口：1280x720、1440x900、1920x1080。

### Grid

- 桌面：`232px minmax(0, 1fr) 280px` 三栏。
- 低于 1200px：检查器覆盖式打开，不压缩主网格。
- 低于 900px 仅用于测试组件适应性，不作为 portable 应用正式最小宽度。

### Rules

- 工具栏、按钮、计数和状态变化不能改变外层尺寸。
- 不使用卡片套卡片；侧栏、工作区和检查器是页面结构，不做浮动卡片。
- 内容滚动局限在中央工作区和弹窗正文，窗口框架保持稳定。

## 5. Components

### Command Button

- **Structure**：语义 `<button>`，Lucide 图标加可选文字。
- **Variants**：primary、secondary、ghost、danger、icon、compact。
- **Spacing**：高度 36px；文字按钮水平 12–16px；图标间距 8px。
- **States**：default、hover、active、focus-visible、disabled、loading。
- **Accessibility**：图标按钮必须有 `aria-label` 和 tooltip；焦点环 3px。
- **Motion**：120ms opacity、transform 和颜色过渡；active 最大下移 1px。

### Search Field

- **Structure**：`label`、搜索图标、原生 `input[type=search]`。
- **Variants**：default、focused、populated、disabled。
- **States**：显示结果计数或清除按钮时外框尺寸不变。
- **Accessibility**：明确可见标签通过 `aria-label`；Esc 清空。

### Segmented Control

- **Structure**：单一工具组中的互斥按钮。
- **Variants**：网格/列表、全部/已启用/未启用。
- **States**：inactive、hover、selected、focus-visible、disabled。
- **Accessibility**：使用 `aria-pressed` 或 radiogroup 语义。

### Category Row

- **Structure**：展开按钮、目录图标、名称、计数、可选状态点。
- **Variants**：category、all、recycle-bin、drop-target。
- **States**：default、hover、selected、dragging、drop-target、focus-visible。
- **Accessibility**：未选中行也能从指针按下开始排序；键盘可选择和执行上下移动命令。
- **Motion**：拖动反馈只用 transform 和 opacity。

### Patch Card / List Row

- **Structure**：选择框、固定比例预览、名称、元数据、启用状态。
- **Variants**：patch、group；grid、list；small、medium、large。
- **States**：default、hover、selected、enabled、disabled、dragging、error。
- **Accessibility**：项目是可聚焦选择项；双击预览区设置预览；组角标含文本替代。
- **Motion**：悬停抬升不超过 2px；不改变网格轨道尺寸。

### Inspector Action

- **Structure**：选中项摘要、真实相对路径、启停按钮、移动/重命名/删除命令。
- **Variants**：none、single patch、single group、multi-selection。
- **States**：loading、ready、conflict、read-only recovery。
- **Accessibility**：命令顺序与工具栏一致，错误消息与触发控件关联。

### Dialog

- **Structure**：标题、简短上下文、字段或冲突列表、固定底部操作区。
- **Variants**：form、confirmation、conflict、settings。
- **States**：opening、ready、submitting、error、closing。
- **Accessibility**：焦点锁定、Esc 关闭非破坏性弹窗、初始焦点安全、关闭后恢复焦点。
- **Motion**：150ms opacity 和 scale；减少动态时无 scale。

### Toast

- **Structure**：状态图标、单句结果、可选“查看详情”命令。
- **Variants**：success、info、warning、error。
- **States**：enter、visible、exit；错误不自动快速消失。
- **Accessibility**：普通结果 `status`，错误 `alert`；不抢焦点。

### Primitive Showcase

- 开发模式通过 `?showcase=1` 显示所有上述原语及 default、hover、selected、disabled、loading、empty、error 状态。
- 产品工作台合成前，showcase 必须在 375、768、1280px 截图检查；375/768 只验证原语，不代表桌面应用正式窗口尺寸。

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|---|---:|---|---|
| Micro | 120ms | `cubic-bezier(0.2, 0.6, 0.2, 1)` | 按钮、选择、hover |
| Standard | 150ms | `cubic-bezier(0.2, 0.6, 0.2, 1)` | 菜单、检查器、toast |
| Emphasis | 240ms | `cubic-bezier(0.16, 1, 0.3, 1)` | 对话框、视图切换 |

### Rules

- 只动画 `transform`、`opacity`、必要的 `filter`；不动画布局属性。
- 动效只说明可交互、状态切换或空间关系，不做装饰循环。
- `prefers-reduced-motion: reduce` 时禁用位移和缩放，只保留即时颜色/可见性变化。
- 分类拖动、框选和项目拖放必须有明确目标反馈和取消路径。

## 7. Depth & Surface

### Strategy: Mixed, border-led

- 主结构使用 tonal shift 加 1px 边框，不使用大面积浮动阴影。
- 默认表面：`surface` + `border`。
- 选中/悬停：`elevated` + `border-strong`；活动项可增加 2px 靛蓝顶边或左轨。
- 菜单与模态可使用 `0 16px 48px rgba(0, 0, 0, 0.46)`，这是唯一常规大阴影层级。
- 焦点只用 `--color-focus` 环，不用发光阴影代替可访问焦点。

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- 目标：WCAG 2.2 AA；正文对比度至少 4.5:1，大文字和图形至少 3:1。
- 所有命令、分类、项目、菜单和弹窗可用键盘完成。
- 不依赖颜色表达启用、冲突或错误；提供图标与文字。
- 支持 `prefers-reduced-motion`、Windows 125%/150% 缩放和长中文文件名。
- 破坏性操作需要清晰对象名称和结果范围；批量冲突列出具体文件。
- 用户在重复文件操作中需要稳定位置和反馈，成功通知简短，错误通知保留足够时间。

### Inclusive Walkthrough Personas

- **高频整理者**：数百补丁、鼠标多选和拖放，要求密度高但不跳动。
- **键盘使用者**：依赖 Tab、方向键、Enter、Space、F2 和 Delete 完成核心流程。
- **低视力/高缩放用户**：125%–150% 缩放下仍需看到完整命令和明确焦点。
- **谨慎恢复者**：在冲突和状态损坏时需要知道哪些文件未被修改以及恢复位置。

### Accepted Debt

当前无已接受设计债务。任何无法在本轮修复的无障碍或原语状态缺口必须在此记录并获得用户明确接受。

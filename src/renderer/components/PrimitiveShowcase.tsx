import { Import, Trash2 } from "lucide-react";
import { CommandButton, SegmentedControl, StatusBadge, Toast } from "./primitives";

export function PrimitiveShowcase(): React.JSX.Element {
  return (
    <main className="showcase-shell">
      <header className="showcase-heading">
        <span className="eyebrow">Halo / Development</span>
        <h1>组件状态展台</h1>
        <p>
          核心原语在真实令牌、稳定尺寸和语义状态下的<span className="nowrap">视觉基准</span>。
        </p>
      </header>

      <section className="showcase-section" aria-labelledby="showcase-buttons">
        <h2 id="showcase-buttons">命令按钮</h2>
        <div className="showcase-row">
          <CommandButton variant="primary" icon={<Import size={16} />}>
            主操作
          </CommandButton>
          <CommandButton>次要操作</CommandButton>
          <CommandButton variant="ghost">轻量操作</CommandButton>
          <CommandButton variant="danger" icon={<Trash2 size={16} />}>
            危险操作
          </CommandButton>
          <CommandButton disabled>不可用操作</CommandButton>
          <CommandButton loading>处理中</CommandButton>
        </div>
      </section>

      <section className="showcase-section" aria-labelledby="showcase-states">
        <h2 id="showcase-states">筛选与状态</h2>
        <div className="showcase-row">
          <SegmentedControl
            ariaLabel="展台筛选"
            onChange={() => undefined}
            options={[
              { label: "全部", value: "all" },
              { label: "已启用", value: "enabled" },
              { label: "未启用", value: "disabled" },
            ]}
            value="enabled"
          />
          <StatusBadge tone="success">已启用</StatusBadge>
          <StatusBadge tone="warning">有冲突</StatusBadge>
          <StatusBadge tone="info">等待导入</StatusBadge>
          <StatusBadge tone="error">操作失败</StatusBadge>
        </div>
      </section>

      <section className="showcase-section" aria-labelledby="showcase-feedback">
        <h2 id="showcase-feedback">通知</h2>
        <div className="showcase-toast-stack">
          <Toast tone="success">补丁已成功启用</Toast>
          <Toast tone="info">扫描完成，没有发现外部变化</Toast>
          <Toast tone="warning">目标目录空间不足，需要确认后继续</Toast>
          <Toast tone="error">
            冲突示例：同名补丁已存在，<span className="nowrap">未修改磁盘内容</span>
          </Toast>
        </div>
      </section>
    </main>
  );
}

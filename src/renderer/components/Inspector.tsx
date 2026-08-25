import { Boxes, ChevronRight, FolderInput, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { itemDescription, type WorkspaceItem } from "../workspace/model";
import { CommandButton, StatusBadge } from "./primitives";

type InspectorProps = {
  readonly busy: boolean;
  readonly onCreateGroup: () => void;
  readonly onMove: () => void;
  readonly onRecycle: () => void;
  readonly onRename: () => void;
  readonly onSetEnabled: (enabled: boolean) => void;
  readonly selectedItems: readonly WorkspaceItem[];
  readonly readOnly: boolean;
  readonly onCollapse: () => void;
};

export function Inspector({
  busy,
  onCreateGroup,
  onMove,
  onRecycle,
  onRename,
  onSetEnabled,
  selectedItems,
  readOnly,
  onCollapse,
}: InspectorProps): React.JSX.Element {
  const selectedItem = selectedItems.length === 1 ? selectedItems[0] : undefined;
  const allEnabled = selectedItems.length > 0 && selectedItems.every((item) => item.enabled);
  const canGroup =
    selectedItems.length >= 2 && selectedItems.every((item) => item.kind === "patch");

  return (
    <aside className="inspector" aria-label="项目详情">
      <button
        aria-label="收起检查器"
        className="icon-button compact inspector-toggle"
        onClick={onCollapse}
        title="收起检查器"
        type="button"
      >
        <ChevronRight size={15} />
      </button>
      <span className="eyebrow">检查器</span>
      {selectedItems.length === 0 ? (
        <>
          <h2>未选择项目</h2>
          <p>
            选择补丁或组后，可在这里查看<span className="nowrap">真实路径和启用状态</span>。
          </p>
        </>
      ) : (
        <>
          <h2>{selectedItem?.name ?? `已选择 ${selectedItems.length} 个项目`}</h2>
          <StatusBadge tone={allEnabled ? "success" : "neutral"}>
            {allEnabled
              ? "全部已启用"
              : `${selectedItems.filter((item) => item.enabled).length} 个已启用`}
          </StatusBadge>
          {selectedItem === undefined ? (
            <ul className="selection-summary">
              {selectedItems.slice(0, 5).map((item) => (
                <li key={item.relativePath}>{item.name}</li>
              ))}
            </ul>
          ) : (
            <dl className="inspector-details">
              <dt>类型</dt>
              <dd>{selectedItem.kind === "group" ? "补丁组" : "NPK 补丁"}</dd>
              <dt>相对路径</dt>
              <dd>{selectedItem.relativePath}</dd>
              <dt>内容</dt>
              <dd>{itemDescription(selectedItem)}</dd>
            </dl>
          )}
          <div className="inspector-actions">
            <CommandButton
              disabled={busy || readOnly}
              icon={allEnabled ? <PowerOff size={16} /> : <Power size={16} />}
              onClick={() => onSetEnabled(!allEnabled)}
              variant="primary"
            >
              {selectedItems.length === 1
                ? allEnabled
                  ? "停用"
                  : "启用"
                : allEnabled
                  ? "停用选中"
                  : "启用选中"}
            </CommandButton>
            {selectedItem === undefined ? null : (
              <CommandButton
                disabled={busy || readOnly}
                icon={<Pencil size={16} />}
                onClick={onRename}
              >
                重命名
              </CommandButton>
            )}
            <CommandButton
              disabled={busy || readOnly}
              icon={<FolderInput size={16} />}
              onClick={onMove}
            >
              移动
            </CommandButton>
            {canGroup ? (
              <CommandButton
                disabled={busy || readOnly}
                icon={<Boxes size={16} />}
                onClick={onCreateGroup}
              >
                打组
              </CommandButton>
            ) : null}
            <CommandButton
              disabled={busy || readOnly}
              icon={<Trash2 size={16} />}
              onClick={onRecycle}
              variant="danger"
            >
              移入回收站
            </CommandButton>
          </div>
        </>
      )}
    </aside>
  );
}

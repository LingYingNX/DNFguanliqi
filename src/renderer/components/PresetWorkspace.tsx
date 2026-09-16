import { FileWarning, Layers, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { pathKey } from "../../shared/path-key";
import type { PresetSummary } from "../../shared/preset-contracts";
import type { WorkspaceItem } from "../workspace/model";
import { StatusBadge } from "./primitives";

type PresetWorkspaceProps = {
  readonly busyKey: string | null;
  readonly loading: boolean;
  readonly onDelete: (preset: PresetSummary) => void;
  readonly onToggle: (id: string, enabled: boolean) => void;
  readonly onRename: (preset: PresetSummary) => void;
  readonly presets: readonly PresetSummary[];
  readonly readOnly: boolean;
  readonly workspaceItems: readonly WorkspaceItem[];
  readonly workspaceLoading: boolean;
};

function isPresetEnabled(preset: PresetSummary, workspaceItems: readonly WorkspaceItem[]): boolean {
  if (preset.items.length === 0 || preset.missingPaths.length > 0) return false;

  const enabledByPath = new Map(
    workspaceItems.flatMap((item) =>
      item.kind === "patch" ? [[pathKey(item.relativePath), item.enabled] as const] : [],
    ),
  );
  return preset.items.every((item) => enabledByPath.get(pathKey(item.relativePath)) === true);
}

export function PresetWorkspace({
  busyKey,
  loading,
  onDelete,
  onToggle,
  onRename,
  presets,
  readOnly,
  workspaceItems,
  workspaceLoading,
}: PresetWorkspaceProps): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPreset = presets.find((preset) => preset.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId !== null && selectedPreset === null) {
      setSelectedId(null);
    }
  }, [selectedId, selectedPreset]);

  return (
    <main className="preset-workspace" aria-label="预设工作区">
      {loading ? (
        <section className="empty-state" aria-label="正在读取预设">
          <Layers className="spin" size={28} />
          <h3>正在读取预设</h3>
        </section>
      ) : presets.length === 0 ? (
        <section className="empty-state" aria-label="暂无预设">
          <div className="empty-icon">
            <Layers size={26} />
          </div>
          <h3>暂无预设</h3>
          <p>在补丁工作区选中 NPK 后，可以从选中操作条创建预设。</p>
        </section>
      ) : (
        <div className="preset-layout">
          <section className="preset-list" aria-label="本地预设列表">
            {presets.map((preset) => {
              const busy = busyKey === preset.id;
              const enabled = isPresetEnabled(preset, workspaceItems);
              return (
                <article
                  className="preset-row"
                  data-selected={selectedId === preset.id}
                  key={preset.id}
                >
                  <button
                    aria-label={`查看预设 ${preset.name}`}
                    aria-pressed={selectedId === preset.id}
                    className="preset-select"
                    onClick={() => setSelectedId(preset.id)}
                    type="button"
                  >
                    <span className="preset-icon" aria-hidden="true">
                      <Layers size={18} />
                    </span>
                    <span className="preset-row-copy">
                      <strong>{preset.name}</strong>
                      <span>{preset.items.length} 个补丁</span>
                    </span>
                    {preset.missingPaths.length === 0 ? null : (
                      <StatusBadge tone="warning">缺失 {preset.missingPaths.length} 项</StatusBadge>
                    )}
                  </button>
                  <div className="preset-row-actions">
                    <label
                      aria-busy={busy}
                      className="switch preset-switch"
                      title={busy ? "正在切换预设" : enabled ? "停用预设" : "启用预设"}
                    >
                      <input
                        aria-label={`${enabled ? "停用" : "启用"}预设 ${preset.name}`}
                        checked={enabled}
                        disabled={readOnly || busy || workspaceLoading}
                        onChange={(event) => onToggle(preset.id, event.currentTarget.checked)}
                        type="checkbox"
                      />
                      <span className="slider" />
                    </label>
                    <button
                      aria-label={`重命名预设 ${preset.name}`}
                      className="icon-button compact"
                      disabled={readOnly || busy}
                      onClick={() => onRename(preset)}
                      title="重命名预设"
                      type="button"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label={`删除预设 ${preset.name}`}
                      className="icon-button compact icon-button-danger"
                      disabled={readOnly || busy}
                      onClick={() => onDelete(preset)}
                      title="删除预设"
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          {selectedPreset === null ? (
            <section className="preset-detail empty-state" aria-label="预设引用">
              <Layers size={24} />
              <p>选择一个预设查看引用的补丁。</p>
            </section>
          ) : (
            <section className="preset-detail" aria-label="预设引用">
              <div className="preset-detail-heading">
                <div>
                  <span className="eyebrow">引用列表</span>
                  <h3>{selectedPreset.name}</h3>
                </div>
                <span className="status-chip">{selectedPreset.items.length} 个补丁</span>
              </div>
              <ul className="preset-item-list">
                {selectedPreset.items.map((item) => {
                  const missing = selectedPreset.missingPaths.includes(item.relativePath);
                  return (
                    <li key={item.relativePath} data-missing={missing}>
                      {missing ? (
                        <FileWarning size={15} aria-hidden="true" />
                      ) : (
                        <Layers size={15} />
                      )}
                      <span>{item.relativePath}</span>
                      {missing ? <small>缺失，安装时跳过</small> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

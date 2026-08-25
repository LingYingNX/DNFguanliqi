import { type FormEvent, useState } from "react";
import type {
  AddItemsToPresetRequest,
  CreatePresetRequest,
  DeletePresetRequest,
  PresetItemReference,
  PresetSummary,
  RenamePresetRequest,
} from "../../shared/preset-contracts";
import { Dialog } from "./Dialog";
import { CommandButton } from "./primitives";

export type PresetDialog =
  | { readonly kind: "selection"; readonly items: readonly PresetItemReference[] }
  | { readonly kind: "rename"; readonly preset: PresetSummary }
  | { readonly kind: "delete"; readonly preset: PresetSummary }
  | null;

type PresetDialogsProps = {
  readonly active: PresetDialog;
  readonly onAddItems: (request: AddItemsToPresetRequest) => Promise<boolean>;
  readonly onClose: () => void;
  readonly onCreate: (request: CreatePresetRequest) => Promise<boolean>;
  readonly onDelete: (request: DeletePresetRequest) => Promise<boolean>;
  readonly onRename: (request: RenamePresetRequest) => Promise<boolean>;
  readonly presets: readonly PresetSummary[];
};

function SelectionDialog({
  items,
  onAddItems,
  onClose,
  onCreate,
  presets,
}: {
  readonly items: readonly PresetItemReference[];
  readonly onAddItems: PresetDialogsProps["onAddItems"];
  readonly onClose: PresetDialogsProps["onClose"];
  readonly onCreate: PresetDialogsProps["onCreate"];
  readonly presets: PresetDialogsProps["presets"];
}): React.JSX.Element {
  const [name, setName] = useState("");
  const [targetPresetId, setTargetPresetId] = useState("new");
  const [submitting, setSubmitting] = useState(false);
  const creating = targetPresetId === "new";

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    const success = creating
      ? await onCreate({ name: name.trim(), items: [...items] })
      : await onAddItems({ id: targetPresetId, items: [...items] });
    if (success) onClose();
    else setSubmitting(false);
  };

  return (
    <Dialog onClose={onClose} title="加入预设">
      <form onSubmit={(event) => void submit(event)}>
        <div className="dialog-body">
          <p className="dialog-supporting-text">
            将引用 {items.length} 个选中的 NPK 文件，不复制文件。
          </p>
          {presets.length === 0 ? null : (
            <label className="form-field">
              <span>目标预设</span>
              <select
                aria-label="目标预设"
                onChange={(event) => setTargetPresetId(event.currentTarget.value)}
                value={targetPresetId}
              >
                <option value="new">新建预设</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {creating ? (
            <label className="form-field">
              <span>预设名称</span>
              <input
                aria-label="预设名称"
                data-dialog-initial-focus
                onChange={(event) => setName(event.currentTarget.value)}
                value={name}
              />
            </label>
          ) : null}
        </div>
        <div className="dialog-actions">
          <CommandButton onClick={onClose}>取消</CommandButton>
          <CommandButton
            disabled={creating && name.trim().length === 0}
            loading={submitting}
            type="submit"
            variant="primary"
          >
            {creating ? "创建预设" : "追加到预设"}
          </CommandButton>
        </div>
      </form>
    </Dialog>
  );
}

function RenameDialog({
  onClose,
  onRename,
  preset,
}: Pick<PresetDialogsProps, "onClose" | "onRename"> & {
  readonly preset: PresetSummary;
}): React.JSX.Element {
  const [name, setName] = useState(preset.name);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    if (await onRename({ id: preset.id, name: name.trim() })) onClose();
    else setSubmitting(false);
  };

  return (
    <Dialog onClose={onClose} title="重命名预设">
      <form onSubmit={(event) => void submit(event)}>
        <div className="dialog-body">
          <label className="form-field">
            <span>预设名称</span>
            <input
              aria-label="预设名称"
              data-dialog-initial-focus
              onChange={(event) => setName(event.currentTarget.value)}
              value={name}
            />
          </label>
        </div>
        <div className="dialog-actions">
          <CommandButton onClick={onClose}>取消</CommandButton>
          <CommandButton
            disabled={name.trim().length === 0}
            loading={submitting}
            type="submit"
            variant="primary"
          >
            确认
          </CommandButton>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({
  onClose,
  onDelete,
  preset,
}: Pick<PresetDialogsProps, "onClose" | "onDelete"> & {
  readonly preset: PresetSummary;
}): React.JSX.Element {
  const [deleting, setDeleting] = useState(false);
  return (
    <Dialog onClose={onClose} title="删除预设">
      <div className="dialog-body">
        <p>确定删除预设“{preset.name}”？引用的 NPK 文件不会被删除。</p>
      </div>
      <div className="dialog-actions">
        <CommandButton onClick={onClose}>取消</CommandButton>
        <CommandButton
          data-dialog-initial-focus
          loading={deleting}
          onClick={() => {
            setDeleting(true);
            void onDelete({ id: preset.id }).then((success) => {
              if (success) onClose();
              else setDeleting(false);
            });
          }}
          variant="danger"
        >
          确认删除
        </CommandButton>
      </div>
    </Dialog>
  );
}

export function PresetDialogs({
  active,
  onAddItems,
  onClose,
  onCreate,
  onDelete,
  onRename,
  presets,
}: PresetDialogsProps): React.JSX.Element | null {
  if (active?.kind === "selection") {
    return (
      <SelectionDialog
        items={active.items}
        onAddItems={onAddItems}
        onClose={onClose}
        onCreate={onCreate}
        presets={presets}
      />
    );
  }
  if (active?.kind === "rename") {
    return <RenameDialog onClose={onClose} onRename={onRename} preset={active.preset} />;
  }
  if (active?.kind === "delete") {
    return <DeleteDialog onClose={onClose} onDelete={onDelete} preset={active.preset} />;
  }
  return null;
}

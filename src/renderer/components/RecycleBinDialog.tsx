import { useState } from "react";
import type { RecycleEntryDto } from "../../shared/ipc-contracts";
import { Dialog } from "./Dialog";
import { CommandButton } from "./primitives";

type RecycleBinOperations = {
  readonly emptyRecycle: () => Promise<boolean>;
  readonly restore: (id: string) => Promise<boolean>;
};

type RecycleBinDialogProps = {
  readonly onClose: () => void;
  readonly operations: RecycleBinOperations;
  readonly recycleEntries: readonly RecycleEntryDto[];
};

export function RecycleBinDialog({
  onClose,
  operations,
  recycleEntries,
}: RecycleBinDialogProps): React.JSX.Element {
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const restore = async (id: string): Promise<void> => {
    setSubmitting(true);
    await operations.restore(id);
    setSubmitting(false);
  };
  const empty = async (): Promise<void> => {
    setSubmitting(true);
    if (await operations.emptyRecycle()) {
      setConfirmEmpty(false);
    }
    setSubmitting(false);
  };
  return (
    <Dialog onClose={onClose} title="回收站">
      <div className="dialog-body recycle-bin-body">
        {recycleEntries.length === 0 ? (
          <p>回收站为空。</p>
        ) : (
          <ul className="recycle-list">
            {recycleEntries.map((entry) => (
              <li key={entry.id}>
                <span>
                  <strong>{entry.originalRelativePath}</strong>
                  <small>{entry.kind === "group" ? "补丁组" : "NPK 补丁"}</small>
                </span>
                <CommandButton disabled={submitting} onClick={() => void restore(entry.id)}>
                  恢复
                </CommandButton>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="dialog-actions">
        {confirmEmpty ? (
          <>
            <span className="dialog-confirm-label">确定清空全部回收项目？</span>
            <CommandButton disabled={submitting} onClick={() => setConfirmEmpty(false)}>
              取消
            </CommandButton>
            <CommandButton
              disabled={submitting}
              loading={submitting}
              onClick={() => void empty()}
              variant="danger"
            >
              确认清空
            </CommandButton>
          </>
        ) : (
          <CommandButton
            disabled={recycleEntries.length === 0}
            onClick={() => setConfirmEmpty(true)}
            variant="danger"
          >
            清空回收站
          </CommandButton>
        )}
      </div>
    </Dialog>
  );
}

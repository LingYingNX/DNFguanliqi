import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { DnfApi } from "../../shared/ipc-contracts";

type Props = {
  readonly client: DnfApi | undefined;
};

export function WindowTitleBar({ client }: Props): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (client === undefined) return;
    const unsubscribe = client.windowControls.subscribeState((state) => {
      setIsMaximized(state.isMaximized);
    });
    void client.windowControls.getState().then((result) => {
      if (result.ok) setIsMaximized(result.value.isMaximized);
    });
    return unsubscribe;
  }, [client]);

  const minimize = (): void => {
    if (client !== undefined) void client.windowControls.minimize();
  };

  const toggleMaximize = (): void => {
    if (client === undefined) return;
    void client.windowControls.toggleMaximize().then((result) => {
      if (result.ok) setIsMaximized(result.value.isMaximized);
    });
  };

  const close = (): void => {
    if (client !== undefined) void client.windowControls.close();
  };

  const handleDragRegionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleMaximize();
  };

  return (
    <header className="window-titlebar">
      <button
        aria-label="双击切换最大化"
        className="window-titlebar-drag-region"
        data-testid="window-titlebar-drag-region"
        tabIndex={0}
        type="button"
        onDoubleClick={toggleMaximize}
        onKeyDown={handleDragRegionKeyDown}
      >
        <span className="window-titlebar-title">
          <span>{`${client?.appInfo.name ?? "DNF 补丁管理器"} ${client?.appInfo.version ?? "1.2.3"}`}</span>
          <span className="window-titlebar-author">作者：铃音奈绪</span>
        </span>
      </button>
      <div className="window-controls">
        <button
          aria-label="最小化"
          className="window-control-button"
          disabled={client === undefined}
          title="最小化"
          type="button"
          onClick={minimize}
        >
          <Minus aria-hidden="true" size={14} strokeWidth={1.8} />
        </button>
        <button
          aria-label={isMaximized ? "还原" : "最大化"}
          className="window-control-button"
          disabled={client === undefined}
          title={isMaximized ? "还原" : "最大化"}
          type="button"
          onClick={toggleMaximize}
        >
          {isMaximized ? (
            <Copy aria-hidden="true" size={13} strokeWidth={1.8} />
          ) : (
            <Square aria-hidden="true" size={13} strokeWidth={1.8} />
          )}
        </button>
        <button
          aria-label="关闭"
          className="window-control-button window-control-close"
          disabled={client === undefined}
          title="关闭"
          type="button"
          onClick={close}
        >
          <X aria-hidden="true" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}

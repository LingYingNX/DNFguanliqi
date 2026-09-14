import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type ContextMenuAction = {
  readonly children?: readonly ContextMenuAction[];
  readonly disabled?: boolean;
  readonly icon: React.ReactNode;
  readonly kind?: "delete";
  readonly label: string;
  readonly onClick: () => void;
};

type ContextMenuProps = {
  readonly actions: readonly ContextMenuAction[];
  readonly className?: string;
  readonly disabled?: boolean;
  readonly onClose: () => void;
  readonly x: number;
  readonly y: number;
};

type MenuListProps = {
  readonly actions: readonly ContextMenuAction[];
  readonly disabled: boolean;
  readonly onClose: () => void;
  readonly openPath: readonly number[];
  readonly path: readonly number[];
  readonly setOpenPath: (path: readonly number[]) => void;
};

function pathIsOpen(openPath: readonly number[], path: readonly number[]): boolean {
  return path.every((segment, index) => openPath[index] === segment);
}

function pathsEqual(first: readonly number[], second: readonly number[]): boolean {
  return (
    first.length === second.length && first.every((segment, index) => second[index] === segment)
  );
}

function MenuList({
  actions,
  disabled,
  onClose,
  openPath,
  path,
  setOpenPath,
}: MenuListProps): React.JSX.Element {
  return (
    <div className="item-context-menu-list list">
      {actions.map((action, index) => {
        const actionPath = [...path, index];
        const children = action.children ?? [];
        const hasChildren = children.length > 0;
        const expanded = hasChildren && pathIsOpen(openPath, actionPath);
        const runAction = (): void => {
          onClose();
          action.onClick();
        };
        const runPointerAction = (event: React.PointerEvent<HTMLButtonElement>): void => {
          if (event.button !== 0) return;
          event.preventDefault();
          runAction();
        };

        return hasChildren ? (
          <fieldset
            className="item-context-submenu"
            key={action.label}
            onFocus={() => setOpenPath(actionPath)}
            onMouseEnter={() => setOpenPath(actionPath)}
          >
            <button
              aria-expanded={expanded}
              aria-haspopup="menu"
              className={`item-context-menu-item element${action.kind === "delete" ? " delete" : ""}`}
              disabled={disabled || action.disabled}
              onClick={runAction}
              onPointerDown={runPointerAction}
              role="menuitem"
              type="button"
            >
              {action.icon}
              <span>{action.label}</span>
              <ChevronRight className="item-context-menu-chevron" size={14} />
            </button>
            {expanded ? (
              <div className="item-context-submenu-panel card" role="menu">
                <MenuList
                  actions={children}
                  disabled={disabled}
                  onClose={onClose}
                  openPath={openPath}
                  path={actionPath}
                  setOpenPath={setOpenPath}
                />
              </div>
            ) : null}
          </fieldset>
        ) : (
          <button
            className={`item-context-menu-item element${action.kind === "delete" ? " delete" : ""}`}
            disabled={disabled || action.disabled}
            key={action.label}
            onClick={runAction}
            onPointerDown={runPointerAction}
            role="menuitem"
            type="button"
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ContextMenu({
  actions,
  className,
  disabled = false,
  onClose,
  x,
  y,
}: ContextMenuProps): React.JSX.Element {
  const [openPath, setOpenPath] = useState<readonly number[]>([]);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const openMenuPath = (path: readonly number[]): void => {
    setOpenPath((current) => (pathsEqual(current, path) ? current : path));
  };

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) {
        return;
      }
      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={`item-context-menu card${className === undefined ? "" : ` ${className}`}`}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
      style={{ left: x, top: y }}
    >
      <MenuList
        actions={actions}
        disabled={disabled}
        onClose={onClose}
        openPath={openPath}
        path={[]}
        setOpenPath={openMenuPath}
      />
    </div>
  );
}

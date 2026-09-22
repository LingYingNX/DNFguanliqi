import { ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// 菜单与窗口边缘的最小间距，与侧边栏分类菜单的收边留白一致。
const VIEWPORT_MARGIN = 8;

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
  const [placement, setPlacement] = useState<{
    left: number;
    originX: string;
    originY: string;
    top: number;
  }>({ left: x, originX: "left", originY: "top", top: y });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const openMenuPath = (path: readonly number[]): void => {
    setOpenPath((current) => (pathsEqual(current, path) ? current : path));
  };

  // 菜单固定定位在光标处，滚动无法把它带回视口；向下放不下时改为向上展开，
  // 向右放不下时向左收边，避免贴着窗口下缘/右缘右键时菜单被裁掉。
  // transform-origin 同步指向光标所在角，入场缩放才会"从点击处生长"。
  useLayoutEffect(() => {
    const node = menuRef.current;
    if (node === null) return;
    const { width, height } = node.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const flipsLeft = x + width + VIEWPORT_MARGIN > window.innerWidth;
    const flipsUp = y + height + VIEWPORT_MARGIN > window.innerHeight;
    const left = flipsLeft
      ? Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)
      : x;
    const top = flipsUp ? Math.max(VIEWPORT_MARGIN, y - height) : y;
    const next = {
      left,
      originX: flipsLeft ? "right" : "left",
      originY: flipsUp ? "bottom" : "top",
      top,
    };
    setPlacement((current) =>
      current.left === next.left && current.top === next.top ? current : next,
    );
  }, [x, y]);

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) {
        return;
      }
      onClose();
    };
    // 菜单不随内容滚动（fixed 定位），滚动后继续悬浮只会与卡片错位，直接关闭。
    const closeOnScroll = (): void => {
      onClose();
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("scroll", closeOnScroll, { capture: true, passive: true });
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("scroll", closeOnScroll, { capture: true });
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={`item-context-menu card${className === undefined ? "" : ` ${className}`}`}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
      style={{
        left: placement.left,
        top: placement.top,
        transformOrigin: `${placement.originY} ${placement.originX}`,
      }}
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

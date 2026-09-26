import { useCallback, useRef, useState } from "react";

type SidebarResizeHandleProps = {
  readonly maximumWidth: number;
  readonly minimumWidth: number;
  readonly onChange: (width: number) => void;
  readonly width: number;
};

type ResizeStart = {
  readonly pointerId: number;
  readonly width: number;
  readonly x: number;
};

export function SidebarResizeHandle({
  maximumWidth,
  minimumWidth,
  onChange,
  width,
}: SidebarResizeHandleProps): React.JSX.Element {
  const [dragging, setDragging] = useState(false);
  const resizeStartRef = useRef<ResizeStart | null>(null);

  const finishResize = useCallback((event: React.PointerEvent<HTMLHRElement>): void => {
    const resizeStart = resizeStartRef.current;
    if (resizeStart === null || resizeStart.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    resizeStartRef.current = null;
    setDragging(false);
  }, []);

  return (
    <hr
      aria-label="调整侧边栏宽度"
      aria-orientation="vertical"
      aria-valuemax={maximumWidth}
      aria-valuemin={minimumWidth}
      aria-valuenow={width}
      className="sidebar-resize-handle"
      data-dragging={dragging ? "true" : undefined}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 32 : 16;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onChange(width - step);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onChange(width + step);
        } else if (event.key === "Home") {
          event.preventDefault();
          onChange(minimumWidth);
        } else if (event.key === "End") {
          event.preventDefault();
          onChange(maximumWidth);
        }
      }}
      onLostPointerCapture={finishResize}
      onPointerCancel={finishResize}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        resizeStartRef.current = {
          pointerId: event.pointerId,
          width,
          x: event.clientX,
        };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const resizeStart = resizeStartRef.current;
        if (resizeStart === null || resizeStart.pointerId !== event.pointerId) return;
        onChange(resizeStart.width + event.clientX - resizeStart.x);
      }}
      onPointerUp={finishResize}
      tabIndex={0}
      title="拖拽调整侧边栏宽度"
    />
  );
}

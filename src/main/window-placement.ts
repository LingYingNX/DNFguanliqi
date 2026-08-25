export type DisplayWorkArea = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type WindowSize = {
  readonly width: number;
  readonly height: number;
};

export type WindowBounds = WindowSize & {
  readonly x: number;
  readonly y: number;
};

function overlapsDisplay(window: WindowBounds, display: DisplayWorkArea): boolean {
  return (
    window.x < display.x + display.width &&
    window.x + window.width > display.x &&
    window.y < display.y + display.height &&
    window.y + window.height > display.y
  );
}

export function recoverWindowPosition(
  window: WindowBounds,
  displays: readonly DisplayWorkArea[],
): { readonly x: number; readonly y: number } {
  if (displays.some((display) => overlapsDisplay(window, display))) {
    return { x: window.x, y: window.y };
  }

  const primaryDisplay = displays[0];
  if (primaryDisplay === undefined) {
    return { x: window.x, y: window.y };
  }

  return centeredWindowPosition(primaryDisplay, window);
}

export function centeredWindowPosition(
  workArea: DisplayWorkArea,
  windowSize: WindowSize,
): { readonly x: number; readonly y: number } {
  return {
    x: Math.max(workArea.x, workArea.x + Math.floor((workArea.width - windowSize.width) / 2)),
    y: Math.max(workArea.y, workArea.y + Math.floor((workArea.height - windowSize.height) / 2)),
  };
}

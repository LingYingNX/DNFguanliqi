import { useEffect, useMemo, useState } from "react";
import { type WorkspaceItem, workspaceItemKey } from "./model";

export type SelectionModifiers = {
  readonly range: boolean;
  readonly toggle: boolean;
};

export function useItemSelection(items: readonly WorkspaceItem[]) {
  const [selectedPaths, setSelectedPaths] = useState<readonly string[]>([]);
  const [anchorPath, setAnchorPath] = useState<string | null>(null);
  const itemPaths = useMemo(() => items.map(workspaceItemKey), [items]);

  useEffect(() => {
    setSelectedPaths((current) => current.filter((path) => itemPaths.includes(path)));
    setAnchorPath((current) => (current !== null && itemPaths.includes(current) ? current : null));
  }, [itemPaths]);

  const selectItem = (path: string, modifiers: SelectionModifiers): void => {
    if (modifiers.range && anchorPath !== null) {
      const anchorIndex = itemPaths.indexOf(anchorPath);
      const targetIndex = itemPaths.indexOf(path);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        setSelectedPaths(itemPaths.slice(start, end + 1));
        return;
      }
    }

    if (modifiers.toggle) {
      setSelectedPaths((current) => {
        if (current.includes(path)) {
          const next = current.filter((selectedPath) => selectedPath !== path);
          setAnchorPath(next.at(-1) ?? null);
          return next;
        }
        setAnchorPath(path);
        return [...current, path];
      });
      return;
    }

    setSelectedPaths([path]);
    setAnchorPath(path);
  };

  const selectBox = (paths: readonly string[]): void => {
    const next = itemPaths.filter((path) => paths.includes(path));
    setSelectedPaths(next);
    setAnchorPath(next.at(-1) ?? null);
  };

  return {
    clearSelection: () => {
      setSelectedPaths([]);
      setAnchorPath(null);
    },
    selectBox,
    selectedItems: items.filter((item) => selectedPaths.includes(workspaceItemKey(item))),
    selectedPaths,
    selectItem,
  };
}

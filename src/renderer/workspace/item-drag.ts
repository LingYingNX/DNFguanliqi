import type { WorkspaceItemReference } from "./model";

export const LIBRARY_ITEMS_DRAG_TYPE = "application/x-dnf-library-items";

function isWorkspaceItemReference(value: unknown): value is WorkspaceItemReference {
  if (typeof value !== "object" || value === null) return false;
  const reference = value as {
    readonly kind?: unknown;
    readonly relativePath?: unknown;
    readonly groupId?: unknown;
  };
  if (reference.kind === "patch") {
    return typeof reference.relativePath === "string" && reference.relativePath.length > 0;
  }
  return reference.kind === "group" && typeof reference.groupId === "string";
}

export function encodeWorkspaceItemDrag(items: readonly WorkspaceItemReference[]): string {
  return JSON.stringify(items);
}

export function isWorkspaceItemsDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(LIBRARY_ITEMS_DRAG_TYPE);
}

export function decodeWorkspaceItemDrag(value: string): readonly WorkspaceItemReference[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every(isWorkspaceItemReference)) return [];
    return parsed;
  } catch {
    return [];
  }
}

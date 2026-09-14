import type { GroupItem, PatchItem } from "../../shared/library-dto";

export type WorkspaceItem = PatchItem | GroupItem;
export type EnabledFilter = "all" | "enabled";
export type ViewMode = "grid" | "list";
export type CardSize = "small" | "medium" | "large";
export type Notice = {
  readonly message: string;
  readonly tone: "success" | "warning" | "info" | "error";
};

export function itemMatches(item: WorkspaceItem, query: string, filter: EnabledFilter): boolean {
  const matchesQuery = item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase());
  return matchesQuery && (filter === "all" || item.enabled);
}

export function itemDescription(item: WorkspaceItem): string {
  if (item.kind === "group") {
    return `${item.patchCount} 个补丁`;
  }
  if (item.size < 1024) {
    return `${item.size} B`;
  }
  if (item.size < 1024 * 1024) {
    return `${(item.size / 1024).toFixed(1)} KB`;
  }
  return `${(item.size / 1024 / 1024).toFixed(1)} MB`;
}

export function itemDate(item: WorkspaceItem): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
    new Date(item.kind === "patch" ? item.modifiedAt : item.createdAt),
  );
}

export function itemType(item: WorkspaceItem): string {
  return item.kind === "patch" ? "补丁" : "补丁组";
}

export function itemLocation(item: WorkspaceItem, categoryPath: string): string | null {
  const normalizedPath = item.relativePath.replaceAll("/", "\\");
  const separatorIndex = normalizedPath.lastIndexOf("\\");
  const parentPath = separatorIndex < 0 ? "" : normalizedPath.slice(0, separatorIndex);
  const normalizedCategory = categoryPath.replaceAll("/", "\\");
  if (parentPath.toLocaleLowerCase() === normalizedCategory.toLocaleLowerCase()) return null;
  if (normalizedCategory === "") return parentPath;
  const prefix = `${normalizedCategory}\\`;
  return parentPath.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())
    ? parentPath.slice(prefix.length)
    : parentPath;
}

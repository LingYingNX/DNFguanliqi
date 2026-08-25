import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { ChildCategory } from "../../shared/library-dto";
import { decodeWorkspaceItemDrag, LIBRARY_ITEMS_DRAG_TYPE } from "../workspace/item-drag";
import type { WorkspaceItemReference } from "../workspace/model";

export type CategoryDropPosition = "before" | "inside" | "after";

export type CategoryDragState = {
  readonly sourceCategories: readonly ChildCategory[];
  readonly sourceParentRelativePath: string;
  readonly sourceRelativePath: string;
};

export type CategoryDropTarget = {
  readonly position: CategoryDropPosition;
  readonly targetCategories: readonly ChildCategory[];
  readonly targetIndex: number;
  readonly targetParentRelativePath: string;
  readonly targetRelativePath: string;
};

type CategoryTreeProps = {
  readonly categories: readonly ChildCategory[];
  readonly categoryPath: string;
  readonly depth?: number;
  readonly expandedPaths: ReadonlySet<string>;
  readonly dragSourceRelativePath: string | null;
  readonly dropTarget: CategoryDropTarget | null;
  readonly itemDropTargetRelativePath: string | null;
  readonly onMoveItems: (
    targetRelativePath: string,
    items: readonly WorkspaceItemReference[],
  ) => void;
  readonly onItemDragLeave: () => void;
  readonly onItemDragOver: (relativePath: string) => void;
  readonly onCategoryDragOver: (target: CategoryDropTarget) => void;
  readonly onCategoryDragStart: (drag: CategoryDragState) => void;
  readonly onSelect: (relativePath: string) => void;
  readonly onToggle: (relativePath: string) => void;
  readonly parentRelativePath?: string;
  readonly readOnly: boolean;
};

export function reorderedCategories(
  categories: readonly ChildCategory[],
  sourceRelativePath: string,
  targetRelativePath: string,
  position: CategoryDropPosition,
): readonly ChildCategory[] {
  if (position === "inside") return categories;
  const source = categories.find((category) => category.relativePath === sourceRelativePath);
  if (source === undefined) return categories;
  const next = categories.filter((category) => category.relativePath !== sourceRelativePath);
  const targetIndex = next.findIndex((category) => category.relativePath === targetRelativePath);
  if (targetIndex < 0) return categories;
  next.splice(targetIndex + (position === "after" ? 1 : 0), 0, source);
  return next;
}

function dropPosition(event: React.PointerEvent<HTMLButtonElement>): CategoryDropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  if (rect.height <= 0 || !Number.isFinite(event.clientY)) return "after";
  const offset = event.clientY - rect.top;
  const edge = rect.height * 0.25;
  if (offset < edge) return "before";
  if (offset > rect.height - edge) return "after";
  return "inside";
}

function isPathWithin(relativePath: string, parentRelativePath: string): boolean {
  const path = relativePath.replaceAll("/", "\\").toLocaleLowerCase();
  const parent = parentRelativePath.replaceAll("/", "\\").toLocaleLowerCase();
  return path === parent || path.startsWith(`${parent}\\`);
}

function isLibraryItemsDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(LIBRARY_ITEMS_DRAG_TYPE);
}

export function CategoryTree({
  categories,
  categoryPath,
  depth = 0,
  dragSourceRelativePath,
  dropTarget,
  itemDropTargetRelativePath,
  expandedPaths,
  onMoveItems,
  onItemDragLeave,
  onItemDragOver,
  onCategoryDragOver,
  onCategoryDragStart,
  onSelect,
  onToggle,
  parentRelativePath = "",
  readOnly,
}: CategoryTreeProps): React.JSX.Element {
  const visibleCategories = categories;
  return (
    <div className="category-tree">
      {visibleCategories.map((category) => {
        const hasChildren = category.childCategories.length > 0;
        const expanded = expandedPaths.has(category.relativePath);
        const itemDropTarget = itemDropTargetRelativePath === category.relativePath;
        return (
          <div className="category-node" key={category.relativePath}>
            <div className="category-node-line" style={{ paddingLeft: depth * 14 }}>
              {hasChildren ? (
                <button
                  aria-label={`${expanded ? "折叠" : "展开"} ${category.name}`}
                  className="category-expand"
                  onClick={() => onToggle(category.relativePath)}
                  type="button"
                >
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="category-expand-spacer" />
              )}
              <button
                aria-label={category.name}
                className={`category-row ${categoryPath === category.relativePath ? "selected" : ""} ${dropTarget?.targetRelativePath === category.relativePath ? `drop-${dropTarget.position}` : ""} ${itemDropTarget ? "item-drop-target" : ""}`}
                data-item-drop-target={itemDropTarget ? "true" : undefined}
                data-drop-position={
                  dropTarget?.targetRelativePath === category.relativePath
                    ? dropTarget.position
                    : undefined
                }
                onClick={() => onSelect(category.relativePath)}
                onDragEnter={(event) => {
                  if (readOnly || !isLibraryItemsDrag(event.dataTransfer)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  onItemDragOver(category.relativePath);
                }}
                onDragLeave={(event) => {
                  if (
                    event.relatedTarget instanceof Node &&
                    event.currentTarget.contains(event.relatedTarget)
                  ) {
                    return;
                  }
                  onItemDragLeave();
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (readOnly || !isLibraryItemsDrag(event.dataTransfer)) {
                    return;
                  }
                  event.dataTransfer.dropEffect = "move";
                  onItemDragOver(category.relativePath);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  onItemDragLeave();
                  if (readOnly) return;
                  const items = decodeWorkspaceItemDrag(
                    event.dataTransfer.getData(LIBRARY_ITEMS_DRAG_TYPE),
                  );
                  if (items.length > 0) onMoveItems(category.relativePath, items);
                }}
                onPointerDown={(event) => {
                  if (readOnly || event.buttons !== 1) return;
                  onCategoryDragStart({
                    sourceCategories: visibleCategories,
                    sourceParentRelativePath: parentRelativePath,
                    sourceRelativePath: category.relativePath,
                  });
                }}
                onPointerEnter={(event) => {
                  if (event.buttons !== 1 || dragSourceRelativePath === null) return;
                  if (isPathWithin(category.relativePath, dragSourceRelativePath)) return;
                  const position = dropPosition(event);
                  const targetCategories =
                    position === "inside" ? category.childCategories : visibleCategories;
                  const withoutSource = targetCategories.filter(
                    (candidate) => candidate.relativePath !== dragSourceRelativePath,
                  );
                  const targetIndex =
                    position === "inside"
                      ? withoutSource.length
                      : withoutSource.findIndex(
                          (candidate) => candidate.relativePath === category.relativePath,
                        ) + (position === "after" ? 1 : 0);
                  if (targetIndex < 0) return;
                  onCategoryDragOver({
                    position,
                    targetCategories,
                    targetIndex,
                    targetParentRelativePath:
                      position === "inside" ? category.relativePath : parentRelativePath,
                    targetRelativePath: category.relativePath,
                  });
                }}
                onPointerMove={(event) => {
                  if (event.buttons !== 1 || dragSourceRelativePath === null) return;
                  if (isPathWithin(category.relativePath, dragSourceRelativePath)) return;
                  const position = dropPosition(event);
                  const targetCategories =
                    position === "inside" ? category.childCategories : visibleCategories;
                  const withoutSource = targetCategories.filter(
                    (candidate) => candidate.relativePath !== dragSourceRelativePath,
                  );
                  const targetIndex =
                    position === "inside"
                      ? withoutSource.length
                      : withoutSource.findIndex(
                          (candidate) => candidate.relativePath === category.relativePath,
                        ) + (position === "after" ? 1 : 0);
                  if (targetIndex < 0) return;
                  onCategoryDragOver({
                    position,
                    targetCategories,
                    targetIndex,
                    targetParentRelativePath:
                      position === "inside" ? category.relativePath : parentRelativePath,
                    targetRelativePath: category.relativePath,
                  });
                }}
                type="button"
              >
                <Folder size={16} />
                <span>{category.name}</span>
                <span aria-hidden="true" className="category-count">
                  {category.patchCount}
                </span>
              </button>
            </div>
            {hasChildren && expanded ? (
              <CategoryTree
                categories={category.childCategories}
                categoryPath={categoryPath}
                depth={depth + 1}
                dragSourceRelativePath={dragSourceRelativePath}
                dropTarget={dropTarget}
                expandedPaths={expandedPaths}
                itemDropTargetRelativePath={itemDropTargetRelativePath}
                onMoveItems={onMoveItems}
                onItemDragLeave={onItemDragLeave}
                onItemDragOver={onItemDragOver}
                onCategoryDragOver={onCategoryDragOver}
                onCategoryDragStart={onCategoryDragStart}
                onSelect={onSelect}
                onToggle={onToggle}
                parentRelativePath={category.relativePath}
                readOnly={readOnly}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

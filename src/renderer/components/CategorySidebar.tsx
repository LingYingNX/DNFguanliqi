import {
  Archive,
  FolderOpen,
  FolderPlus,
  Globe2,
  Layers,
  PackageOpen,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MoveCategoryRequest } from "../../shared/ipc-contracts";
import type { CategorySnapshot, ChildCategory } from "../../shared/library-dto";
import {
  isRootPatch,
  type NavigationSelection,
  type WorkspaceItemReference,
} from "../workspace/model";
import {
  type CategoryDragState,
  type CategoryDropTarget,
  CategoryTree,
  reorderedCategories,
} from "./CategoryTree";

type CategorySidebarProps = {
  readonly categoryPath: string;
  readonly navigation: NavigationSelection;
  readonly onSelect: (relativePath: string) => void;
  readonly onSelectNavigation: (selection: NavigationSelection) => void;
  readonly onRecycleBin: () => void;
  readonly onAppearance: () => void;
  readonly onSettings: () => void;
  readonly onMoveCategory: (request: MoveCategoryRequest) => void;
  readonly onMoveItems: (
    targetRelativePath: string,
    items: readonly WorkspaceItemReference[],
  ) => void;
  readonly onCreateCategory: () => void;
  readonly onDeleteCategory: (hasContents: boolean) => void;
  readonly onReorder: (
    parentRelativePath: string,
    orderedChildRelativePaths: readonly string[],
  ) => void;
  readonly presetCount?: number;
  readonly snapshot: CategorySnapshot | null;
  readonly readOnly: boolean;
};

function SystemRow({
  count,
  icon,
  label,
  onClick,
  selected,
}: {
  readonly count?: number;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly selected: boolean;
}): React.JSX.Element {
  return (
    <button
      aria-current={selected ? "page" : undefined}
      aria-pressed={selected}
      className={`category-row system-nav-row ${selected ? "selected" : ""}`}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
      {count === undefined ? null : (
        <span aria-hidden="true" className="category-count">
          {count}
        </span>
      )}
    </button>
  );
}

function countCategoryPatches(categories: readonly ChildCategory[]): number {
  return categories.reduce(
    (count, category) =>
      count + category.patchCount + countCategoryPatches(category.childCategories),
    0,
  );
}

function categoryHasContents(
  categories: readonly ChildCategory[],
  relativePath: string,
): boolean | null {
  const targetPath = relativePath.replaceAll("/", "\\").toLocaleLowerCase();
  for (const category of categories) {
    if (category.relativePath.replaceAll("/", "\\").toLocaleLowerCase() === targetPath) {
      return category.patchCount > 0 || category.childCategories.length > 0;
    }
    const nested = categoryHasContents(category.childCategories, relativePath);
    if (nested !== null) return nested;
  }
  return null;
}

export function CategorySidebar({
  categoryPath,
  navigation,
  onSelect,
  onSelectNavigation,
  onRecycleBin,
  onAppearance,
  onSettings,
  onMoveCategory,
  onMoveItems,
  onCreateCategory,
  onDeleteCategory,
  onReorder,
  presetCount = 0,
  snapshot,
  readOnly,
}: CategorySidebarProps): React.JSX.Element {
  const [dragState, setDragState] = useState<CategoryDragState | null>(null);
  const [dropTarget, setDropTarget] = useState<CategoryDropTarget | null>(null);
  const [itemDropTargetRelativePath, setItemDropTargetRelativePath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(new Set());
  const draggingRef = useRef(false);
  const suppressNextCategoryClickRef = useRef(false);

  useEffect(() => {
    const segments = categoryPath.split(/[\\/]/u).filter((segment) => segment.length > 0);
    const ancestors = segments
      .slice(0, -1)
      .map((_, index) => segments.slice(0, index + 1).join("\\"));
    if (ancestors.length > 0) {
      setExpandedPaths((current) => new Set([...current, ...ancestors]));
    }
  }, [categoryPath]);

  const selectCategory = (relativePath: string): void => {
    if (suppressNextCategoryClickRef.current) {
      suppressNextCategoryClickRef.current = false;
      return;
    }
    onSelect(relativePath);
  };

  const startCategoryDrag = (nextDrag: CategoryDragState): void => {
    draggingRef.current = false;
    suppressNextCategoryClickRef.current = false;
    setDragState(nextDrag);
    setDropTarget(null);
    setItemDropTargetRelativePath(null);
  };

  const updateCategoryDropTarget = (nextTarget: CategoryDropTarget): void => {
    if (dragState === null) return;
    draggingRef.current = true;
    setDropTarget(nextTarget);
  };

  const finishOrdering = (): void => {
    const currentDrag = dragState;
    const currentTarget = dropTarget;
    const wasDragging = draggingRef.current;
    draggingRef.current = false;
    setDragState(null);
    setDropTarget(null);
    setItemDropTargetRelativePath(null);
    if (!wasDragging || currentDrag === null || currentTarget === null) return;
    suppressNextCategoryClickRef.current = true;
    if (
      currentTarget.position !== "inside" &&
      currentTarget.targetParentRelativePath === currentDrag.sourceParentRelativePath
    ) {
      onReorder(
        currentDrag.sourceParentRelativePath,
        reorderedCategories(
          currentDrag.sourceCategories,
          currentDrag.sourceRelativePath,
          currentTarget.targetRelativePath,
          currentTarget.position,
        ).map((category) => category.relativePath),
      );
      return;
    }
    const sourceCategory = currentDrag.sourceCategories.find(
      (category) => category.relativePath === currentDrag.sourceRelativePath,
    );
    if (sourceCategory === undefined) return;
    const movedRelativePath =
      currentTarget.targetParentRelativePath === ""
        ? sourceCategory.name
        : `${currentTarget.targetParentRelativePath}\\${sourceCategory.name}`;
    if (
      movedRelativePath.replaceAll("/", "\\").toLocaleLowerCase() ===
      currentDrag.sourceRelativePath.replaceAll("/", "\\").toLocaleLowerCase()
    ) {
      return;
    }
    const targetParentChildRelativePaths = currentTarget.targetCategories
      .filter((category) => category.relativePath !== currentDrag.sourceRelativePath)
      .map((category) => category.relativePath);
    targetParentChildRelativePaths.splice(currentTarget.targetIndex, 0, movedRelativePath);
    const request: MoveCategoryRequest = {
      sourceParentRelativePath: currentDrag.sourceParentRelativePath,
      sourceRelativePath: currentDrag.sourceRelativePath,
      targetParentRelativePath: currentTarget.targetParentRelativePath,
      targetIndex: currentTarget.targetIndex,
      sourceParentChildRelativePaths: currentDrag.sourceCategories
        .filter((category) => category.relativePath !== currentDrag.sourceRelativePath)
        .map((category) => category.relativePath),
      targetParentChildRelativePaths,
    };
    onMoveCategory(request);
  };

  const rootPatches = snapshot?.patches.filter(isRootPatch) ?? [];
  const hasRecursiveItems =
    snapshot?.patches.some((patch) => !isRootPatch(patch)) === true ||
    snapshot?.groups.some(
      (group) => (group.categoryRelativePath ?? group.relativePath).split(/[\\/]/u).length > 1,
    ) === true;
  const allCount =
    snapshot === null
      ? 0
      : snapshot.patches.length +
        snapshot.groups.length +
        (hasRecursiveItems ? 0 : countCategoryPatches(snapshot.childCategories));
  const categorySelection = navigation.kind === "category" ? navigation.relativePath : "";

  return (
    <nav
      className="category-sidebar"
      aria-label="补丁分类"
      onKeyDown={(event) => {
        if (event.key !== "Delete" || readOnly || categoryPath === "") return;
        if (
          !(event.target instanceof HTMLElement) ||
          event.target.closest(".category-row") === null
        ) {
          return;
        }
        event.preventDefault();
        onDeleteCategory(
          categoryHasContents(snapshot?.childCategories ?? [], categoryPath) ?? true,
        );
      }}
      onPointerCancel={finishOrdering}
      onPointerUp={finishOrdering}
    >
      <div className="sidebar-heading">
        <span className="sidebar-commands">
          <button
            aria-label="新建子分类"
            className="icon-button compact"
            disabled={readOnly}
            onClick={onCreateCategory}
            title="新建子分类"
            type="button"
          >
            <FolderPlus size={15} />
          </button>
        </span>
        <div className="sidebar-settings-actions">
          <button
            aria-label="调整外观"
            className="sidebar-appearance-button"
            onClick={onAppearance}
            title="调整外观"
            type="button"
          >
            <SlidersHorizontal size={14} />
            <span>调整外观</span>
          </button>
          <button
            aria-label="设置"
            className="icon-button compact sidebar-settings-button"
            onClick={onSettings}
            title="设置"
            type="button"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      <div className="sidebar-system-nav">
        <SystemRow
          icon={<Archive size={16} />}
          label="回收站"
          onClick={onRecycleBin}
          selected={false}
        />
        <SystemRow
          count={allCount}
          icon={<FolderOpen size={16} />}
          label="全部"
          onClick={() => onSelectNavigation({ kind: "all" })}
          selected={navigation.kind === "all"}
        />
        <SystemRow
          count={rootPatches.length}
          icon={<PackageOpen size={16} />}
          label="未分类"
          onClick={() => onSelectNavigation({ kind: "uncategorized" })}
          selected={navigation.kind === "uncategorized"}
        />
        <SystemRow
          count={presetCount}
          icon={<Layers size={16} />}
          label="预设"
          onClick={() => onSelectNavigation({ kind: "presets" })}
          selected={navigation.kind === "presets"}
        />
        <SystemRow
          icon={<Globe2 size={16} />}
          label="资源社区"
          onClick={() => onSelectNavigation({ kind: "community" })}
          selected={navigation.kind === "community"}
        />
      </div>

      <hr className="sidebar-separator" />

      <CategoryTree
        categories={snapshot?.childCategories ?? []}
        categoryPath={categorySelection}
        dragSourceRelativePath={dragState?.sourceRelativePath ?? null}
        dropTarget={dropTarget}
        expandedPaths={expandedPaths}
        itemDropTargetRelativePath={itemDropTargetRelativePath}
        onMoveItems={onMoveItems}
        onItemDragLeave={() => setItemDropTargetRelativePath(null)}
        onItemDragOver={setItemDropTargetRelativePath}
        onCategoryDragOver={updateCategoryDropTarget}
        onCategoryDragStart={startCategoryDrag}
        onSelect={selectCategory}
        onToggle={(path) =>
          setExpandedPaths((current) => {
            const next = new Set(current);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
          })
        }
        readOnly={readOnly}
      />
      {snapshot !== null && snapshot.childCategories.length === 0 ? (
        <div className="sidebar-empty">当前目录没有子分类。</div>
      ) : null}
    </nav>
  );
}

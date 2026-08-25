import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import type { DnfApi } from "../../src/shared/ipc-contracts";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

function transfer(): {
  readonly files: readonly File[];
  readonly getDragImage: () => Element | null;
  readonly getData: (type: string) => string;
  readonly setDragImage: (element: Element, offsetX: number, offsetY: number) => void;
  readonly setData: (type: string, value: string) => void;
  readonly types: readonly string[];
} {
  const values = new Map<string, string>();
  const types: string[] = [];
  let dragImage: Element | null = null;
  return {
    files: [],
    getDragImage: () => dragImage,
    getData: (type) => values.get(type) ?? "",
    setDragImage: (element) => {
      dragImage = element;
    },
    setData: (type, value) => {
      values.set(type, value);
      if (!types.includes(type)) types.push(type);
    },
    types,
  };
}

describe("workspace drag and drop", () => {
  it("does not expose a file-picker button for an empty patch library", async () => {
    // Given: an empty library snapshot.
    const snapshot = {
      ...WORKSPACE_SNAPSHOT,
      patchCount: 0,
      patches: [],
      groups: [],
    };
    render(<App api={createFakeApi(snapshot)} />);

    // When: the empty workspace is displayed.
    await screen.findByText("补丁库还是空的");

    // Then: importing is available only through drag and drop.
    expect(screen.queryByRole("button", { name: "选择 NPK 文件" })).not.toBeInTheDocument();
  });

  it("reorders categories from pointer-down without selecting the source row", async () => {
    // Given: two real child-category rows and a tracked ordering API.
    const requests: Array<Parameters<DnfApi["setCategoryOrder"]>[0]> = [];
    const snapshot = {
      ...WORKSPACE_SNAPSHOT,
      childCategories: [
        { name: "Category A", relativePath: "Category A", patchCount: 0, childCategories: [] },
        { name: "Category B", relativePath: "Category B", patchCount: 0, childCategories: [] },
      ],
    };
    const api: DnfApi = {
      ...createFakeApi(snapshot),
      setCategoryOrder: async (request) => {
        requests.push(request);
        return { ok: true, value: { orderedCount: request.orderedChildRelativePaths.length } };
      },
    };
    render(<App api={api} />);
    const source = await screen.findByRole("button", { name: "Category A" });
    const target = screen.getByRole("button", { name: "Category B" });

    // When: pointer ordering starts on the unselected source and crosses the target.
    fireEvent.pointerDown(source, { buttons: 1, pointerId: 1 });
    fireEvent.pointerEnter(target, { buttons: 1, pointerId: 1 });

    expect(
      screen
        .getAllByRole("button")
        .filter((button) =>
          ["Category A", "Category B"].includes(button.getAttribute("aria-label") ?? ""),
        )
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Category A", "Category B"]);

    fireEvent.pointerUp(target, { pointerId: 1 });

    // Then: order persists through the typed API without navigating to the source.
    await waitFor(() =>
      expect(requests).toEqual([
        {
          parentRelativePath: "",
          orderedChildRelativePaths: ["Category B", "Category A"],
        },
      ]),
    );
    expect(source).not.toHaveClass("selected");
  });

  it("selects a category on click without scheduling a reorder", async () => {
    const requests: Array<Parameters<DnfApi["setCategoryOrder"]>[0]> = [];
    const snapshot = {
      ...WORKSPACE_SNAPSHOT,
      childCategories: [
        { name: "Category A", relativePath: "Category A", patchCount: 0, childCategories: [] },
        { name: "Category B", relativePath: "Category B", patchCount: 0, childCategories: [] },
      ],
    };
    const api: DnfApi = {
      ...createFakeApi(snapshot),
      setCategoryOrder: async (request) => {
        requests.push(request);
        return { ok: true, value: { orderedCount: request.orderedChildRelativePaths.length } };
      },
    };
    render(<App api={api} />);
    const source = await screen.findByRole("button", { name: "Category A" });

    fireEvent.pointerDown(source, { buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(source, { pointerId: 1 });
    fireEvent.click(source);

    await waitFor(() => expect(source).toHaveClass("selected"));
    expect(requests).toEqual([]);
  });

  it("refreshes root ordering without replacing the browsed child workspace", async () => {
    // Given: the user is browsing a child snapshot while the sidebar still shows root categories.
    const rootSnapshot = {
      ...WORKSPACE_SNAPSHOT,
      childCategories: [
        { name: "Category A", relativePath: "Category A", patchCount: 0, childCategories: [] },
        { name: "Category B", relativePath: "Category B", patchCount: 0, childCategories: [] },
      ],
    };
    const orderedRootSnapshot = {
      ...rootSnapshot,
      childCategories: [...rootSnapshot.childCategories].reverse(),
    };
    const childSnapshot = {
      relativePath: "Category A",
      patchCount: 1,
      patches: [
        {
          kind: "patch" as const,
          name: "child.npk",
          relativePath: "Category A\\child.npk",
          previewRelativePath: null,
          previewUrl: null,
          size: 1024,
          modifiedAt: "2026-07-18T00:00:00.000Z",
          enabled: false,
        },
      ],
      groups: [],
      childCategories: [],
    };
    let rootScanCount = 0;
    const api: DnfApi = {
      ...createFakeApi(rootSnapshot),
      scan: async ({ relativePath }) => {
        if (relativePath === "Category A") {
          return { ok: true, value: childSnapshot };
        }
        rootScanCount += 1;
        return { ok: true, value: rootScanCount === 1 ? rootSnapshot : orderedRootSnapshot };
      },
    };
    render(<App api={api} />);
    const categoryA = await screen.findByRole("button", { name: "Category A" });
    fireEvent.click(categoryA);
    expect(await screen.findByText("child.npk")).toBeInTheDocument();

    // When: root category order is changed from the persistent sidebar.
    const categoryB = screen.getByRole("button", { name: "Category B" });
    fireEvent.pointerDown(categoryA, { buttons: 1, pointerId: 1 });
    fireEvent.pointerEnter(categoryB, { buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(categoryB, { pointerId: 1 });

    // Then: navigation refreshes while the active child item snapshot remains intact.
    await waitFor(() => expect(rootScanCount).toBe(2));
    expect(screen.getByText("child.npk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Category A" })).toHaveClass("selected");
    const categoryRows = screen
      .getAllByRole("button")
      .filter((button) =>
        ["Category A", "Category B"].includes(button.getAttribute("aria-label") ?? ""),
      );
    expect(categoryRows.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Category B",
      "Category A",
    ]);
  });

  it("imports dropped NPK files into the current category", async () => {
    // Given: a local browser File and a tracked preload API.
    let request: Parameters<DnfApi["importDroppedPatches"]>[0] | undefined;
    const dropped = new File(["payload"], "dropped.npk");
    const api: DnfApi = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      importDroppedPatches: async (input) => {
        request = input;
        return { ok: true, value: { importedCount: 1, duplicateCount: 0 } };
      },
    };
    render(<App api={api} />);
    const workspace = await screen.findByRole("main");

    // When: the File is dropped on the item workspace.
    fireEvent.drop(workspace, { dataTransfer: { files: [dropped] } });

    // Then: renderer passes File objects, never filesystem paths, to preload.
    await waitFor(() => expect(request).toEqual({ categoryRelativePath: "", files: [dropped] }));
  });

  it.each(["notes.txt", "sprite.img"])(
    "reports non-NPK drops without invoking the import API: %s",
    async (fileName) => {
      // Given: a non-patch local file.
      let importCount = 0;
      const api: DnfApi = {
        ...createFakeApi(WORKSPACE_SNAPSHOT),
        importDroppedPatches: async () => {
          importCount += 1;
          return { ok: true, value: { importedCount: 1, duplicateCount: 0 } };
        },
      };
      render(<App api={api} />);
      const workspace = await screen.findByRole("main");

      // When: it is dropped on the item workspace.
      fireEvent.drop(workspace, { dataTransfer: { files: [new File(["notes"], fileName)] } });

      // Then: the existing notice surface reports rejection and no IPC call occurs.
      expect(await screen.findByRole("alert")).toHaveTextContent("NPK");
      expect(importCount).toBe(0);
    },
  );

  it("moves the dragged selection onto a real category row", async () => {
    // Given: two selected patches and a real child category.
    const requests: Array<Parameters<DnfApi["moveItems"]>[0]> = [];
    const api: DnfApi = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      moveItems: async (request) => {
        requests.push(request);
        return { ok: true, value: { relativePaths: ["分类A\\coat.npk", "分类A\\sword.npk"] } };
      },
    };
    render(<App api={api} />);
    const coat = await screen.findByRole("button", { name: "coat.npk" });
    const sword = screen.getByRole("button", { name: "sword.npk" });
    fireEvent.click(coat);
    fireEvent.click(sword, { ctrlKey: true });
    const dataTransfer = transfer();

    // When: one selected card is dragged onto the category.
    fireEvent.dragStart(coat, { dataTransfer });
    fireEvent.drop(screen.getByRole("button", { name: "分类A" }), { dataTransfer });

    // Then: one typed batch command moves the entire dragged selection atomically.
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests).toEqual([
      {
        items: [
          { kind: "patch", sourceRelativePath: "coat.npk" },
          { kind: "patch", sourceRelativePath: "sword.npk" },
        ],
        targetDirectoryRelativePath: "分类A",
      },
    ]);
  });

  it("moves an unselected patch directly when its card starts dragging", async () => {
    // Given: an unselected patch card and a real child category.
    const requests: Array<Parameters<DnfApi["moveItems"]>[0]> = [];
    const api: DnfApi = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      moveItems: async (request) => {
        requests.push(request);
        return { ok: true, value: { relativePaths: ["分类A\\coat.npk"] } };
      },
    };
    render(<App api={api} />);
    const coat = await screen.findByRole("button", { name: "coat.npk" });
    const dataTransfer = transfer();

    // When: the user drags the card without clicking it first.
    fireEvent.dragStart(coat, { dataTransfer });
    fireEvent.drop(screen.getByRole("button", { name: "分类A" }), { dataTransfer });

    // Then: the dragged card itself is moved.
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests).toEqual([
      {
        items: [{ kind: "patch", sourceRelativePath: "coat.npk" }],
        targetDirectoryRelativePath: "分类A",
      },
    ]);
  });

  it("moves a dragged patch onto a group card", async () => {
    const requests: Array<Parameters<DnfApi["addGroupMembers"]>[0]> = [];
    const api: DnfApi = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      addGroupMembers: async (request) => {
        requests.push(request);
        return { ok: true, value: { id: request.groupId } };
      },
    };
    render(<App api={api} />);
    const coat = await screen.findByRole("button", { name: "coat.npk" });
    const group = screen.getByRole("button", { name: "套装" });
    const dataTransfer = transfer();

    fireEvent.dragStart(coat, { dataTransfer });
    fireEvent.drop(group, { dataTransfer });

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests).toEqual([
      {
        groupId: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
        patchRelativePaths: ["coat.npk"],
      },
    ]);
  });

  it("uses a compact icon as the native drag preview", async () => {
    // Given: a visible patch card with the browser drag surface available.
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);
    const coat = await screen.findByRole("button", { name: "coat.npk" });
    const dataTransfer = transfer();

    // When: the user starts dragging the card.
    fireEvent.dragStart(coat, { dataTransfer });

    // Then: the drag image is a compact preview element, not the complete card.
    expect(dataTransfer.getDragImage()).toHaveClass("item-drag-preview");
    expect(dataTransfer.getDragImage()).not.toBe(coat);
  });

  it("shows and clears a category target while a patch card is dragged over it", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);
    const coat = await screen.findByRole("button", { name: "coat.npk" });
    const category = screen.getByRole("button", { name: "分类A" });
    const dataTransfer = transfer();

    fireEvent.dragStart(coat, { dataTransfer });
    fireEvent.dragOver(category, { dataTransfer });

    expect(category).toHaveAttribute("data-item-drop-target", "true");

    fireEvent.dragLeave(category, { dataTransfer, relatedTarget: document.body });

    expect(category).not.toHaveAttribute("data-item-drop-target");
  });
});

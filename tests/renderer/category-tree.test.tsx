import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/renderer/App";
import {
  type DnfApi,
  type MoveCategoryRequest,
  MoveCategoryRequestSchema,
} from "../../src/shared/ipc-contracts";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

const treeSnapshot = {
  ...WORKSPACE_SNAPSHOT,
  childCategories: [
    {
      name: "Armor",
      relativePath: "Armor",
      patchCount: 2,
      childCategories: [
        {
          name: "Cloth",
          relativePath: "Armor\\Cloth",
          patchCount: 1,
          childCategories: [],
        },
      ],
    },
  ],
};

describe("category tree", () => {
  it("shows only each category's direct patch count", async () => {
    render(<App api={createFakeApi(treeSnapshot)} />);

    const armor = await screen.findByRole("button", { name: "Armor" });
    expect(armor).toHaveTextContent("2");
    expect(screen.queryByRole("button", { name: "Cloth" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开 Armor" }));

    expect(armor).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cloth" })).toHaveTextContent("1");

    fireEvent.click(armor);
    await waitFor(() => expect(armor).toHaveTextContent("2"));
  });

  it("persists ordering with the nested parent path", async () => {
    const requests: Array<Parameters<DnfApi["setCategoryOrder"]>[0]> = [];
    const snapshot = {
      ...treeSnapshot,
      childCategories: [
        {
          name: "Armor",
          relativePath: "Armor",
          patchCount: 2,
          childCategories: [
            { name: "Cloth", relativePath: "Armor\\Cloth", patchCount: 1, childCategories: [] },
            { name: "Plate", relativePath: "Armor\\Plate", patchCount: 0, childCategories: [] },
          ],
        },
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
    await screen.findByRole("button", { name: "Armor" });
    fireEvent.click(screen.getByRole("button", { name: "展开 Armor" }));
    const cloth = screen.getByRole("button", { name: "Cloth" });
    const plate = screen.getByRole("button", { name: "Plate" });

    fireEvent.pointerDown(cloth, { buttons: 1, pointerId: 1 });
    fireEvent.pointerEnter(plate, { buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(plate, { pointerId: 1 });

    await waitFor(() =>
      expect(requests).toEqual([
        {
          parentRelativePath: "Armor",
          orderedChildRelativePaths: ["Armor\\Plate", "Armor\\Cloth"],
        },
      ]),
    );
  });

  it("inserts a same-level drag after the target lower edge", async () => {
    const requests: Array<{
      readonly parentRelativePath: string;
      readonly orderedChildRelativePaths: readonly string[];
    }> = [];
    const snapshot = {
      ...WORKSPACE_SNAPSHOT,
      childCategories: [
        { name: "First", relativePath: "First", patchCount: 0, childCategories: [] },
        { name: "Target", relativePath: "Target", patchCount: 0, childCategories: [] },
        { name: "Source", relativePath: "Source", patchCount: 0, childCategories: [] },
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
    const source = await screen.findByRole("button", { name: "Source" });
    const target = screen.getByRole("button", { name: "Target" });
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      bottom: 30,
      height: 30,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(source, { buttons: 1, pointerId: 1 });
    fireEvent.pointerEnter(target, { buttons: 1, pointerId: 1, clientY: 29 });
    fireEvent.pointerUp(target, { pointerId: 1 });

    await waitFor(() =>
      expect(requests).toEqual([
        { parentRelativePath: "", orderedChildRelativePaths: ["First", "Target", "Source"] },
      ]),
    );
  });

  it("keeps the source before the target when dropped at its upper edge", async () => {
    const requests: Array<{
      readonly parentRelativePath: string;
      readonly orderedChildRelativePaths: readonly string[];
    }> = [];
    const snapshot = {
      ...WORKSPACE_SNAPSHOT,
      childCategories: [
        { name: "Source", relativePath: "Source", patchCount: 0, childCategories: [] },
        { name: "Target", relativePath: "Target", patchCount: 0, childCategories: [] },
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
    const source = await screen.findByRole("button", { name: "Source" });
    const target = screen.getByRole("button", { name: "Target" });
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      bottom: 30,
      height: 30,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(source, { buttons: 1, pointerId: 1 });
    fireEvent.pointerEnter(target, { buttons: 1, pointerId: 1, clientY: 1 });
    fireEvent.pointerUp(target, { pointerId: 1 });

    await waitFor(() =>
      expect(requests).toEqual([
        { parentRelativePath: "", orderedChildRelativePaths: ["Source", "Target"] },
      ]),
    );
  });

  it("moves a category into the target when dropped in the middle", async () => {
    const requests: MoveCategoryRequest[] = [];
    const snapshot = {
      ...WORKSPACE_SNAPSHOT,
      childCategories: [
        {
          name: "Female",
          relativePath: "Female",
          patchCount: 0,
          childCategories: [
            { name: "Male", relativePath: "Female\\Male", patchCount: 1, childCategories: [] },
          ],
        },
        { name: "Interface", relativePath: "Interface", patchCount: 0, childCategories: [] },
      ],
    };
    const api = {
      ...createFakeApi(snapshot),
      moveCategory: async (request: MoveCategoryRequest) => {
        requests.push(request);
        return { ok: true as const, value: { relativePath: "Interface\\Male" } };
      },
    };
    render(<App api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "展开 Female" }));
    const source = screen.getByRole("button", { name: "Male" });
    const target = screen.getByRole("button", { name: "Interface" });
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      bottom: 30,
      height: 30,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(source, { buttons: 1, pointerId: 1 });
    fireEvent.pointerEnter(target, { buttons: 1, pointerId: 1, clientY: 15 });
    fireEvent.pointerUp(target, { pointerId: 1 });

    await waitFor(() =>
      expect(requests).toEqual([
        {
          sourceParentRelativePath: "Female",
          sourceRelativePath: "Female\\Male",
          targetParentRelativePath: "Interface",
          targetIndex: 0,
          sourceParentChildRelativePaths: [],
          targetParentChildRelativePaths: ["Interface\\Male"],
        },
      ]),
    );
  });

  it("moves a nested category out to the root level", async () => {
    const requests: MoveCategoryRequest[] = [];
    const snapshot = {
      ...WORKSPACE_SNAPSHOT,
      childCategories: [
        {
          name: "Parent",
          relativePath: "Parent",
          patchCount: 0,
          childCategories: [
            { name: "Child", relativePath: "Parent\\Child", patchCount: 0, childCategories: [] },
          ],
        },
        { name: "Sibling", relativePath: "Sibling", patchCount: 0, childCategories: [] },
      ],
    };
    const api = {
      ...createFakeApi(snapshot),
      moveCategory: async (request: MoveCategoryRequest) => {
        requests.push(request);
        return { ok: true as const, value: { relativePath: "Child" } };
      },
    };
    render(<App api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "展开 Parent" }));
    const child = screen.getByRole("button", { name: "Child" });
    const sibling = screen.getByRole("button", { name: "Sibling" });
    vi.spyOn(sibling, "getBoundingClientRect").mockReturnValue({
      bottom: 30,
      height: 30,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(child, { buttons: 1, pointerId: 1 });
    fireEvent.pointerEnter(sibling, { buttons: 1, pointerId: 1, clientY: 29 });
    fireEvent.pointerUp(sibling, { pointerId: 1 });

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toEqual({
      sourceParentRelativePath: "Parent",
      sourceRelativePath: "Parent\\Child",
      targetParentRelativePath: "",
      targetIndex: 2,
      sourceParentChildRelativePaths: [],
      targetParentChildRelativePaths: ["Parent", "Sibling", "Child"],
    });
  });
  it("moves a nested category out to the root via the blank drop zone", async () => {
    const requests: MoveCategoryRequest[] = [];
    const snapshot = {
      ...WORKSPACE_SNAPSHOT,
      childCategories: [
        {
          name: "Parent",
          relativePath: "Parent",
          patchCount: 0,
          childCategories: [
            { name: "Child", relativePath: "Parent\\Child", patchCount: 0, childCategories: [] },
          ],
        },
        { name: "Sibling", relativePath: "Sibling", patchCount: 0, childCategories: [] },
      ],
    };
    const api = {
      ...createFakeApi(snapshot),
      moveCategory: async (request: MoveCategoryRequest) => {
        requests.push(request);
        return { ok: true as const, value: { relativePath: "Child" } };
      },
    };
    render(<App api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "展开 Parent" }));
    const child = screen.getByRole("button", { name: "Child" });

    fireEvent.pointerDown(child, { buttons: 1, pointerId: 1 });
    const dropZone = document.querySelector("[data-category-root-drop]");
    expect(dropZone).not.toBeNull();
    if (dropZone === null) throw new Error("root drop zone missing");
    fireEvent.pointerEnter(dropZone, { buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(dropZone, { pointerId: 1 });

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(MoveCategoryRequestSchema.safeParse(requests[0]).success).toBe(true);
    expect(requests[0]).toEqual({
      sourceParentRelativePath: "Parent",
      sourceRelativePath: "Parent\\Child",
      targetParentRelativePath: "",
      targetIndex: 2,
      sourceParentChildRelativePaths: [],
      targetParentChildRelativePaths: ["Parent", "Sibling", "Child"],
    });
  });
});

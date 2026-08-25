import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import type { DnfApi } from "../../src/shared/ipc-contracts";
import type { CategorySnapshot } from "../../src/shared/library-dto";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

const ROOT_SNAPSHOT: CategorySnapshot = {
  ...WORKSPACE_SNAPSHOT,
  patches: [
    {
      kind: "patch",
      name: "root.npk",
      relativePath: "root.npk",
      previewRelativePath: null,
      previewUrl: null,
      size: 1,
      modifiedAt: "2026-07-22T00:00:00.000Z",
      enabled: false,
    },
  ],
  patchCount: 1,
  childCategories: [
    {
      name: "Armor",
      relativePath: "Armor",
      patchCount: 1,
      childCategories: [],
    },
    { name: "Buff", relativePath: "Buff", patchCount: 0, childCategories: [] },
  ],
};

const DESCENDANT_SNAPSHOT: CategorySnapshot = {
  ...ROOT_SNAPSHOT,
  groups: [
    ...ROOT_SNAPSHOT.groups,
    {
      kind: "group",
      id: "155552bf-49b5-4390-96a7-1846a0c1e9f8",
      name: "Nested bundle",
      relativePath: "Armor\\Nested bundle",
      previewRelativePath: null,
      previewUrl: null,
      patchCount: 2,
      createdAt: "2026-07-22T00:00:00.000Z",
      enabled: false,
    },
  ],
  patchCount: 2,
  patches: [
    ...ROOT_SNAPSHOT.patches,
    {
      kind: "patch",
      name: "nested.npk",
      relativePath: "Armor/nested.npk",
      previewRelativePath: null,
      previewUrl: null,
      size: 1,
      modifiedAt: "2026-07-22T00:00:00.000Z",
      enabled: false,
    },
  ],
};

function createNavigationApi(): DnfApi {
  const base = createFakeApi(ROOT_SNAPSHOT);
  return {
    ...base,
    scan: async ({ includeDescendants, relativePath }) => {
      if (relativePath === "" && includeDescendants) {
        return { ok: true, value: DESCENDANT_SNAPSHOT };
      }
      if (relativePath === "") {
        return { ok: true, value: ROOT_SNAPSHOT };
      }
      return { ok: true, value: ROOT_SNAPSHOT };
    },
  };
}

describe("system navigation", () => {
  it("shows descendant patches in the all-library view", async () => {
    render(<App api={createNavigationApi()} />);
    const sidebar = await screen.findByRole("navigation", { name: "补丁分类" });

    expect(await screen.findByText("nested.npk")).toBeVisible();
    expect(within(sidebar).getByRole("button", { name: "全部" })).toHaveTextContent("4");
    expect(screen.queryByRole("region", { name: "空补丁库" })).not.toBeInTheDocument();
  });

  it("matches the reference sidebar and keeps system views clickable", async () => {
    render(<App api={createNavigationApi()} />);
    const sidebar = await screen.findByRole("navigation", { name: "补丁分类" });

    expect(within(sidebar).getByRole("button", { name: "全部" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "未分类" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "预设" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "资源社区" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Armor" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "包含子分类" }));
    await waitFor(() => expect(screen.getByText("nested.npk")).toBeVisible());
    expect(within(sidebar).getByRole("button", { name: "全部" })).toHaveTextContent("4");

    fireEvent.click(within(sidebar).getByRole("button", { name: "未分类" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "root.npk" })).toBeVisible());
    expect(within(sidebar).getByRole("button", { name: "全部" })).toHaveTextContent("3");
    expect(screen.queryByRole("button", { name: /nested\.npk/u })).not.toBeInTheDocument();

    fireEvent.click(within(sidebar).getByRole("button", { name: "资源社区" }));
    expect(screen.getByText("待构建")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "补丁项目" })).not.toBeInTheDocument();
  });

  it("keeps all count recursive after a category refresh returns a direct root snapshot", async () => {
    const base = createFakeApi(ROOT_SNAPSHOT);
    let rootScanCount = 0;
    const armorSnapshot: CategorySnapshot = {
      ...ROOT_SNAPSHOT,
      relativePath: "Armor",
      patchCount: 1,
      patches: [
        {
          kind: "patch",
          name: "armor.npk",
          relativePath: "Armor\\armor.npk",
          previewRelativePath: null,
          previewUrl: null,
          size: 1,
          modifiedAt: "2026-07-22T00:00:00.000Z",
          enabled: false,
        },
      ],
      groups: [],
      childCategories: [],
    };
    const api: DnfApi = {
      ...base,
      scan: async ({ relativePath }) => {
        if (relativePath === "") {
          rootScanCount += 1;
          return { ok: true, value: rootScanCount === 1 ? DESCENDANT_SNAPSHOT : ROOT_SNAPSHOT };
        }
        return { ok: true, value: armorSnapshot };
      },
    };
    render(<App api={api} />);
    const sidebar = await screen.findByRole("navigation", { name: "补丁分类" });
    await screen.findByText("nested.npk");

    // When: a category refresh updates the root navigation with a direct-only snapshot.
    fireEvent.click(within(sidebar).getByRole("button", { name: "Armor" }));
    const armor = await screen.findByRole("button", { name: "armor.npk" });
    const target = within(sidebar).getByRole("button", { name: "Buff" });
    const values = new Map<string, string>();
    const dataTransfer = {
      files: [],
      getData: (type: string) => values.get(type) ?? "",
      setData: (type: string, value: string) => values.set(type, value),
      types: [] as string[],
    };
    fireEvent.click(armor);
    fireEvent.dragStart(armor, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    // Then: the sidebar still reports root plus all nested category patches.
    await waitFor(() => expect(rootScanCount).toBe(2));
    expect(within(sidebar).getByRole("button", { name: "全部" })).toHaveTextContent("3");
  });
});

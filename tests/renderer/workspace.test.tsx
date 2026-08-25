import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

function dropNpk(name = "imported.npk"): void {
  fireEvent.drop(screen.getByRole("main", { name: "补丁工作区" }), {
    dataTransfer: {
      files: [new File(["payload"], name, { type: "application/octet-stream" })],
    },
  });
}

describe("Halo workspace", () => {
  it("shows the primitive state showcase in development mode", () => {
    window.history.replaceState({}, "", "/?showcase=1");

    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);

    expect(screen.getByRole("heading", { name: "组件状态展台" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "主操作" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "不可用操作" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("冲突示例");
  }, 15_000);

  it("loads real items and applies search without the removed toolbar", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);
    expect(await screen.findByText("coat.npk")).toBeInTheDocument();
    expect(screen.getByText("sword.npk")).toBeInTheDocument();
    expect(screen.getByText("套装")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索补丁" }), {
      target: { value: "coat" },
    });

    expect(screen.getByText("coat.npk")).toBeInTheDocument();
    expect(screen.queryByText("sword.npk")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "搜索补丁" }), {
      target: { value: "" },
    });
    expect(screen.getByText("sword.npk")).toBeInTheDocument();
    expect(screen.getByText("套装")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "仅显示已启用" })).not.toBeInTheDocument();
  });

  it("keeps an empty library visually clear", async () => {
    const emptySnapshot = {
      ...WORKSPACE_SNAPSHOT,
      patchCount: 0,
      patches: [],
      groups: [],
    };

    render(<App api={createFakeApi(emptySnapshot)} />);

    expect(await screen.findByRole("button", { name: "全部 0" })).toBeInTheDocument();
    expect(await screen.findByText("补丁库还是空的")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择 NPK 文件" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "无匹配项目" })).toBeInTheDocument();
  });

  it("refreshes the workspace after importing patches", async () => {
    let scanCount = 0;
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const updatedSnapshot = {
      ...WORKSPACE_SNAPSHOT,
      patchCount: 3,
      patches: [
        ...WORKSPACE_SNAPSHOT.patches,
        {
          kind: "patch" as const,
          name: "imported.npk",
          relativePath: "imported.npk",
          previewRelativePath: null,
          previewUrl: null,
          size: 4096,
          modifiedAt: "2026-07-18T00:00:00.000Z",
          enabled: false,
        },
      ],
    };
    const trackedApi = {
      ...api,
      scan: async (request: { readonly relativePath: string }) => {
        scanCount += 1;
        return scanCount === 1 ? api.scan(request) : { ok: true as const, value: updatedSnapshot };
      },
    };
    render(<App api={trackedApi} />);
    await screen.findByText("coat.npk");

    dropNpk();

    await waitFor(() => {
      expect(scanCount).toBeGreaterThan(1);
    });
    expect(await screen.findByText("imported.npk")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not relabel stale items when a category scan fails", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const failingApi = {
      ...api,
      scan: async (request: { readonly relativePath: string }) =>
        request.relativePath === ""
          ? api.scan(request)
          : { ok: false as const, error: { code: "SCAN_FAILED", message: "分类读取失败" } },
    };
    render(<App api={failingApi} />);
    await screen.findByText("coat.npk");

    fireEvent.click(screen.getByRole("button", { name: "分类A" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("分类读取失败");
    expect(screen.queryByText("coat.npk")).not.toBeInTheDocument();
  });

  it("keeps root navigation stable and clears scan errors after recovery", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    let childAttempts = 0;
    const childSnapshot = {
      relativePath: "分类A",
      patchCount: 1,
      patches: [
        {
          kind: "patch" as const,
          name: "child.npk",
          relativePath: "分类A\\child.npk",
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
    const recoveringApi = {
      ...api,
      scan: async (request: { readonly relativePath: string }) => {
        if (request.relativePath === "") {
          return api.scan(request);
        }
        childAttempts += 1;
        return childAttempts === 1
          ? { ok: false as const, error: { code: "SCAN_FAILED", message: "分类读取失败" } }
          : { ok: true as const, value: childSnapshot };
      },
    };
    render(<App api={recoveringApi} />);
    await screen.findByText("coat.npk");

    fireEvent.click(screen.getByRole("button", { name: "分类A" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("分类读取失败");
    expect(screen.getByRole("button", { name: "分类A" })).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "补丁分类" })).getByRole("button", {
        name: "全部",
      }),
    );
    await screen.findByText("coat.npk");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "分类A" }));

    expect(await screen.findByText("child.npk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "分类A" })).toHaveClass("selected");
  });

  it("preserves a refresh failure after a successful import dialog", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    let scanCount = 0;
    const failingRefreshApi = {
      ...api,
      scan: async (request: { readonly relativePath: string }) => {
        scanCount += 1;
        return scanCount === 1
          ? api.scan(request)
          : { ok: false as const, error: { code: "SCAN_FAILED", message: "导入后刷新失败" } };
      },
    };
    render(<App api={failingRefreshApi} />);
    await screen.findByText("coat.npk");

    dropNpk();

    expect(await screen.findByRole("alert")).toHaveTextContent("导入后刷新失败");
    expect(screen.queryByText("已导入 1 个补丁")).not.toBeInTheDocument();
  });

  it("surfaces a rejected import without replacing the current workspace", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const rejectingApi = {
      ...api,
      importDroppedPatches: async () => Promise.reject(new Error("IPC unavailable")),
    };
    render(<App api={rejectingApi} />);
    await screen.findByText("coat.npk");

    dropNpk();

    expect(await screen.findByRole("alert")).toHaveTextContent("拖入补丁失败，磁盘内容未被修改。");
    expect(screen.getByText("coat.npk")).toBeInTheDocument();
  });
});

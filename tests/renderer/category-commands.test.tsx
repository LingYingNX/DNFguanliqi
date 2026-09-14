import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import type { DnfApi } from "../../src/shared/ipc-contracts";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

describe("category commands", () => {
  it("keeps category rename and deletion out of the sidebar", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);
    await screen.findByText("coat.npk");

    expect(screen.queryByRole("button", { name: "重命名分类" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除分类" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建子分类" })).toBeEnabled();
  });

  it("creates a child category under the current category", async () => {
    let request: Parameters<DnfApi["createCategory"]>[0] | undefined;
    const api: DnfApi = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      createCategory: async (input) => {
        request = input;
        return { ok: true, value: { relativePath: "分类A\\子分类" } };
      },
    };
    render(<App api={api} />);
    const category = await screen.findByRole("button", { name: "分类A" });
    fireEvent.click(category);
    await waitFor(() => expect(category).toHaveClass("selected"));

    fireEvent.click(screen.getByRole("button", { name: "新建子分类" }));
    fireEvent.change(screen.getByRole("textbox", { name: "分类名称" }), {
      target: { value: "子分类" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));

    await waitFor(() => expect(request).toEqual({ parentRelativePath: "分类A", name: "子分类" }));
  });

  it("keeps destructive category commands hidden for a selected category", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);
    const category = await screen.findByRole("button", { name: "分类A" });
    fireEvent.click(category);
    await waitFor(() => expect(category).toHaveClass("selected"));

    expect(screen.queryByRole("button", { name: "重命名分类" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除分类" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建子分类" })).toBeEnabled();
  });

  it("deletes an empty category directly from the Delete key", async () => {
    let request: Parameters<DnfApi["deleteCategory"]>[0] | undefined;
    const api: DnfApi = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      deleteCategory: async (input) => {
        request = input;
        return { ok: true, value: { relativePath: input.relativePath } };
      },
    };
    render(<App api={api} />);
    const category = await screen.findByRole("button", { name: "分类A" });
    fireEvent.click(category);
    await waitFor(() => expect(category).toHaveClass("selected"));

    fireEvent.keyDown(category, { key: "Delete" });

    await waitFor(() => expect(request).toEqual({ relativePath: "分类A", confirmed: true }));
    expect(screen.queryByRole("dialog", { name: "删除分类" })).not.toBeInTheDocument();
  });

  it("warns before attempting to delete a non-empty category", async () => {
    let request: Parameters<DnfApi["deleteCategory"]>[0] | undefined;
    const api: DnfApi = {
      ...createFakeApi({
        ...WORKSPACE_SNAPSHOT,
        childCategories: [
          { name: "分类A", relativePath: "分类A", patchCount: 1, childCategories: [] },
        ],
      }),
      deleteCategory: async (input) => {
        request = input;
        return { ok: true, value: { relativePath: input.relativePath } };
      },
    };
    render(<App api={api} />);
    const category = await screen.findByRole("button", { name: "分类A" });
    fireEvent.click(category);
    await waitFor(() => expect(category).toHaveClass("selected"));

    fireEvent.keyDown(category, { key: "Delete" });

    const dialog = await screen.findByRole("dialog", { name: "警告" });
    expect(dialog).toHaveTextContent("当前目录下还有补丁文件，是否确认删除");
    expect(request).toBeUndefined();
    fireEvent.click(within(dialog).getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(request).toEqual({ relativePath: "分类A", confirmed: true }));
  });
});

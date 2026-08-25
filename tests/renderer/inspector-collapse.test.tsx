import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

describe("workspace layout", () => {
  it("removes the inspector and the old selection action bar", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);
    const workspace = await screen.findByRole("main", { name: "补丁工作区" });

    expect(screen.queryByRole("complementary", { name: "项目详情" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /coat\.npk/u }));
    expect(screen.queryByRole("toolbar", { name: "选中项目操作" })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "停用 coat.npk" })).toBeInTheDocument();
    expect(workspace).toBeInTheDocument();
  });
});

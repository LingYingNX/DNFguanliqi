import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

describe("application shell", () => {
  it("opens directly on the patch management workspace", () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);

    expect(screen.queryByRole("heading", { name: "DNF 补丁管理器" })).not.toBeInTheDocument();
    expect(screen.queryByText("补丁库", { exact: true })).not.toBeInTheDocument();
    expect(document.querySelector(".app-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "导入补丁" })).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "搜索补丁" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "补丁分类" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "补丁工作区" })).toBeInTheDocument();
  }, 15_000);
});

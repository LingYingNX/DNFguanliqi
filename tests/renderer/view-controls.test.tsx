import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

const itemsCss = readFileSync(resolve(process.cwd(), "src/renderer/styles/items.css"), "utf8");

describe("workspace view controls", () => {
  it("switches to an aligned list while preserving selection and search", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);
    const coat = await screen.findByRole("button", { name: "coat.npk" });
    fireEvent.click(coat);
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索补丁" }), {
      target: { value: "coat" },
    });

    fireEvent.click(screen.getByRole("button", { name: "列表视图" }));

    expect(screen.getByRole("button", { name: "列表视图" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "coat.npk" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("searchbox", { name: "搜索补丁" })).toHaveValue("coat");
    const listCard = screen.getByRole("button", { name: "coat.npk" });
    expect(screen.queryByRole("columnheader", { name: "名称" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "类型" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "大小 / 数量" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "日期" })).not.toBeInTheDocument();
    expect(listCard).toHaveTextContent("补丁");
    expect(listCard).toHaveTextContent("2026");
    expect(listCard.querySelector(".status-badge")).toBeNull();
    expect(screen.queryByText(/个项目/u)).not.toBeInTheDocument();
  });

  it("keeps list metadata inside the centered grid body", () => {
    const listBodyRules = [
      ...itemsCss.matchAll(/\.item-list \.item-card-body\s*\{[\s\S]*?\n\}/gu),
    ].map(([rule]) => rule);

    expect(listBodyRules).toHaveLength(1);
    expect(listBodyRules[0]).toContain("display: grid;");
    expect(listBodyRules[0]).not.toContain("display: contents;");
  });

  it("keeps workspace controls ordered while applying status filters", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);
    await screen.findByText("coat.npk");
    expect(screen.queryByText(/个项目/u)).not.toBeInTheDocument();
    const search = screen.getByRole("searchbox", { name: "搜索补丁" });
    const viewControls = screen.getByRole("group", { name: "项目视图" });
    const descendantToggle = screen.getByRole("checkbox", { name: "包含子分类" });
    const statusFilters = screen.getByRole("group", { name: "启用状态" });
    const cards = screen.getByRole("region", { name: "补丁项目" });

    expect(
      search.compareDocumentPosition(viewControls) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      viewControls.compareDocumentPosition(descendantToggle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      statusFilters.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "增大卡片" })).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "全部 3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "已启用 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "未启用 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "已启用 1" }));

    expect(screen.getByRole("button", { name: "已启用 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("coat.npk")).toBeInTheDocument();
    expect(screen.queryByText("sword.npk")).not.toBeInTheDocument();
    expect(screen.queryByText("套装")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "未启用 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "未启用 2" }));

    expect(screen.getByText("sword.npk")).toBeInTheDocument();
    expect(screen.getByText("套装")).toBeInTheDocument();
    expect(screen.queryByText("coat.npk")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "coat" } });

    expect(screen.getByRole("heading", { name: "没有符合条件的项目" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "未启用 2" })).toBeInTheDocument();
  });

  it("scales patch cards with the slider and mouse wheel", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);

    await screen.findByText("coat.npk");
    const cards = screen.getByRole("region", { name: "补丁项目" });
    const scale = screen.getByRole("slider", { name: "补丁卡片缩放" });
    const decrease = screen.getByRole("button", { name: "减小补丁卡片" });
    const increase = screen.getByRole("button", { name: "增大补丁卡片" });

    expect(scale).toHaveValue("100");
    expect(screen.queryByText("卡片大小")).not.toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
    expect(decrease).toBeEnabled();
    expect(increase).toBeEnabled();
    fireEvent.click(increase);
    expect(scale).toHaveValue("105");
    fireEvent.click(decrease);
    expect(scale).toHaveValue("100");
    fireEvent.change(scale, { target: { value: "80" } });
    expect(scale).toHaveValue("80");
    expect(cards).toHaveAttribute("data-card-size", "small");
    expect(cards).toHaveStyle({ "--item-card-min-width": "170px" });

    fireEvent.wheel(scale, { deltaY: -100 });
    expect(scale).toHaveValue("85");
    fireEvent.wheel(scale, { deltaY: 100 });
    expect(scale).toHaveValue("80");

    fireEvent.click(screen.getByRole("button", { name: "列表视图" }));
    expect(cards).toHaveClass("item-list");
    expect(scale).toBeDisabled();
    expect(decrease).toBeDisabled();
    expect(increase).toBeDisabled();
    expect(cards).toHaveAttribute("data-card-size", "large");
    expect(cards).toHaveStyle({ "--item-list-card-height": "76px" });
    expect(cards).toHaveStyle({ "--item-list-thumb-size": "68px" });
    fireEvent.wheel(scale, { deltaY: 100 });
    expect(scale).toHaveValue("80");

    fireEvent.click(screen.getByRole("button", { name: "网格视图" }));
    expect(scale).toBeEnabled();
    expect(cards).toHaveClass("item-grid");
    expect(cards).toHaveStyle({ "--item-card-min-width": "170px" });
  });
});

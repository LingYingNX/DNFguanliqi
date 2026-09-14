import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowTitleBar } from "../../src/renderer/components/WindowTitleBar";
import type { DnfApi } from "../../src/shared/ipc-contracts";

afterEach(() => cleanup());

describe("window title bar", () => {
  it("keeps window controls separate from the drag region", async () => {
    const minimize = vi.fn(async () => ({ ok: true as const, value: null }));
    const toggleMaximize = vi.fn(async () => ({
      ok: true as const,
      value: { isMaximized: true },
    }));
    const close = vi.fn(async () => ({ ok: true as const, value: null }));
    const client = {
      appInfo: { name: "DNF 补丁管理器", version: "1.2.2" },
      windowControls: {
        getState: vi.fn(async () => ({ ok: true as const, value: { isMaximized: false } })),
        minimize,
        toggleMaximize,
        close,
        subscribeState: vi.fn(() => () => {}),
      },
    } as Pick<DnfApi, "appInfo" | "windowControls">;

    render(<WindowTitleBar client={client as DnfApi} />);

    expect(screen.getByTestId("window-titlebar-drag-region")).toBeInTheDocument();
    expect(screen.getByText("DNF 补丁管理器 1.2.2")).toBeInTheDocument();
    expect(screen.getByText("作者：铃音奈绪")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最小化" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最大化" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "最小化" }));
    fireEvent.click(screen.getByRole("button", { name: "最大化" }));
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    fireEvent.doubleClick(screen.getByTestId("window-titlebar-drag-region"));

    expect(minimize).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(toggleMaximize).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByRole("button", { name: "还原" })).toBeInTheDocument());
  });
});

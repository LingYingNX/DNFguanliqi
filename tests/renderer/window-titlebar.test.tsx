import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowTitleBar } from "../../src/renderer/components/WindowTitleBar";
import type { AppUpdate } from "../../src/renderer/workspace/useAppUpdate";
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
      appInfo: { name: "DNF 补丁管理器", version: "1.2.3" },
      windowControls: {
        getState: vi.fn(async () => ({ ok: true as const, value: { isMaximized: false } })),
        minimize,
        toggleMaximize,
        close,
        subscribeState: vi.fn(() => () => {}),
      },
    } as Pick<DnfApi, "appInfo" | "windowControls">;

    render(<WindowTitleBar client={client as DnfApi} update={IDLE_UPDATE} />);

    expect(screen.getByTestId("window-titlebar-drag-region")).toBeInTheDocument();
    expect(screen.getByText("DNF 补丁管理器 1.2.3")).toBeInTheDocument();
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

  it("shows the update notice in the title bar centre", () => {
    const client = {
      appInfo: { name: "DNF 补丁管理器", version: "1.2.3" },
      windowControls: {
        getState: async () => ({ ok: true as const, value: { isMaximized: false } }),
        minimize: async () => ({ ok: true as const, value: null }),
        toggleMaximize: async () => ({ ok: true as const, value: { isMaximized: false } }),
        close: async () => ({ ok: true as const, value: null }),
        subscribeState: () => () => {},
      },
    } as Pick<DnfApi, "appInfo" | "windowControls">;
    const update: AppUpdate = {
      ...IDLE_UPDATE,
      latestVersion: "1.2.4",
      noticeKind: "available",
      noticeSequence: 1,
      phase: "available",
    };

    render(<WindowTitleBar client={client as DnfApi} update={update} />);

    expect(screen.getByRole("status", { name: /发现新版本.*v1\.2\.4/u })).toBeInTheDocument();
  });

  it("announces the current version when a manual check finds no update", () => {
    const client = {
      appInfo: { name: "DNF 补丁管理器", version: "1.2.3" },
      windowControls: {
        getState: async () => ({ ok: true as const, value: { isMaximized: false } }),
        minimize: async () => ({ ok: true as const, value: null }),
        toggleMaximize: async () => ({ ok: true as const, value: { isMaximized: false } }),
        close: async () => ({ ok: true as const, value: null }),
        subscribeState: () => () => {},
      },
    } as Pick<DnfApi, "appInfo" | "windowControls">;
    const update: AppUpdate = {
      ...IDLE_UPDATE,
      latestVersion: "1.2.3",
      noticeKind: "current",
      noticeSequence: 1,
      phase: "current",
    };

    render(<WindowTitleBar client={client as DnfApi} update={update} />);

    expect(screen.getByRole("status", { name: /当前已是最新版.*v1\.2\.3/u })).toBeInTheDocument();
  });
});

const IDLE_UPDATE: AppUpdate = {
  check: async () => {},
  download: async () => {},
  install: async () => {},
  latestVersion: null,
  message: null,
  noticeKind: null,
  noticeSequence: 0,
  phase: "idle",
  progress: 0,
  releaseNotes: [],
};

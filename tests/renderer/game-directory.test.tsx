import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

describe("game directory binding", () => {
  it("saves a manually entered directory path when the field loses focus", async () => {
    const setGameDirectory = vi.fn(async ({ gameDirectory }: { gameDirectory: string }) => ({
      ok: true as const,
      value: { gameDirectory },
    }));
    const api = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      getGameDirectory: async () => ({
        ok: true as const,
        value: { gameDirectory: "D:\\Games\\MyGame" },
      }),
      setGameDirectory,
    };

    render(<App api={api} />);

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    const input = await screen.findByRole("textbox");
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: "D:\\Games\\MyGame\\Long Path" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(setGameDirectory).toHaveBeenCalledWith({
        gameDirectory: "D:\\Games\\MyGame\\Long Path",
      });
    });
  });

  it("moves the directory control into settings instead of the removed toolbar", async () => {
    const api = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      getGameDirectory: async () => ({
        ok: true as const,
        value: { gameDirectory: "D:\\Games\\地下城与勇士" },
      }),
    };

    render(<App api={api} />);

    await screen.findByRole("main", { name: "补丁工作区" });
    expect(screen.queryByRole("button", { name: "游戏目录已设置" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    const input = await screen.findByRole("textbox");
    expect(input).toHaveValue("D:\\Games\\地下城与勇士");
  });

  it("selects a directory from the settings dialog", async () => {
    let selectCount = 0;
    const api = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      getGameDirectory: async () => ({ ok: true as const, value: { gameDirectory: null } }),
      selectGameDirectory: async () => {
        selectCount += 1;
        return { ok: true as const, value: { gameDirectory: "D:\\DNF" } };
      },
    };
    render(<App api={api} />);

    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(await screen.findByRole("button", { name: "浏览" }));
    expect(selectCount).toBe(1);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("D:\\DNF"));
  });

  it("surfaces a persisted-settings read failure", async () => {
    const api = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      getGameDirectory: async () => ({
        ok: false as const,
        error: { code: "STATE_CORRUPT", message: "设置文件损坏" },
      }),
    };

    render(<App api={api} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("设置文件损坏");
  });

  it("clears a transient read error after selection from settings", async () => {
    const api = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      getGameDirectory: async () => Promise.reject(new Error("IPC unavailable")),
      selectGameDirectory: async () => ({
        ok: true as const,
        value: { gameDirectory: "D:\\DNF" },
      }),
    };
    render(<App api={api} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("读取游戏目录设置失败");
    fireEvent.click(screen.getByRole("button", { name: "设置" }));
    fireEvent.click(await screen.findByRole("button", { name: "浏览" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("D:\\DNF"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

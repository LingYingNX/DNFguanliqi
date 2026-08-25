import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

const tokensCss = readFileSync(resolve(process.cwd(), "src/renderer/styles/tokens.css"), "utf8");

describe("appearance settings", () => {
  afterEach(cleanup);
  it("separates directory settings from the appearance controls", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);

    fireEvent.click(await screen.findByRole("button", { name: "设置" }));

    const settingsDialog = screen.getByRole("dialog", { name: "设置" });
    expect(within(settingsDialog).getByText("游戏目录")).toBeInTheDocument();
    expect(within(settingsDialog).getByRole("heading", { name: "支持与社区" })).toBeInTheDocument();
    expect(within(settingsDialog).getByText("请作者喝杯咖啡 ☕")).toBeInTheDocument();
    expect(within(settingsDialog).getByText("哔哩哔哩主页")).toBeInTheDocument();
    expect(within(settingsDialog).getByRole("button", { name: "去赞助" })).toBeInTheDocument();
    expect(within(settingsDialog).getByRole("button", { name: "去关注" })).toBeInTheDocument();
    expect(within(settingsDialog).queryAllByRole("slider")).toHaveLength(0);
    expect(screen.queryByRole("dialog", { name: "调整外观" })).not.toBeInTheDocument();

    fireEvent.click(within(settingsDialog).getByRole("button", { name: "关闭对话框" }));
    fireEvent.click(screen.getByRole("button", { name: "调整外观" }));

    const appearanceDialog = screen.getByRole("dialog", { name: "调整外观" });
    expect(within(appearanceDialog).getAllByRole("slider")).toHaveLength(8);
    expect(
      within(appearanceDialog).getAllByRole("button", { name: /^选择壁纸 \d$/u }),
    ).toHaveLength(5);
    expect(
      within(appearanceDialog).queryAllByRole("button", { name: /^删除壁纸 \d$/u }),
    ).toHaveLength(0);
    expect(within(appearanceDialog).getAllByTestId("wallpaper-placeholder")).toHaveLength(5);

    fireEvent.click(within(appearanceDialog).getByRole("button", { name: "外观主题" }));
    expect(within(appearanceDialog).getByRole("region", { name: "外观主题" })).toBeInTheDocument();
    expect(within(appearanceDialog).queryByText("选择应用外观主题")).not.toBeInTheDocument();
    expect(within(appearanceDialog).queryByText("界面颜色")).not.toBeInTheDocument();
    expect(within(appearanceDialog).queryAllByRole("slider")).toHaveLength(0);
  });

  it("opens the official support links from settings", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const openExternalUrl = vi.fn(api.openExternalUrl);
    render(<App api={{ ...api, openExternalUrl }} />);

    fireEvent.click(await screen.findByRole("button", { name: "设置" }));
    fireEvent.click(screen.getByRole("button", { name: "去赞助" }));
    await waitFor(() =>
      expect(openExternalUrl).toHaveBeenLastCalledWith({ url: "https://afdian.com/a/naixu" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "去关注" }));
    await waitFor(() =>
      expect(openExternalUrl).toHaveBeenLastCalledWith({
        url: "https://space.bilibili.com/41344302",
      }),
    );
  });

  it("keeps the close control in the content toolbar and closes on backdrop click", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);

    fireEvent.click(await screen.findByRole("button", { name: "调整外观" }));

    const appearanceDialog = screen.getByRole("dialog", { name: "调整外观" });
    const resetButton = within(appearanceDialog).getByRole("button", { name: "恢复默认" });
    const closeButton = within(appearanceDialog).getByRole("button", { name: "关闭对话框" });
    expect(closeButton.parentElement).toBe(resetButton.parentElement);

    fireEvent.click(appearanceDialog);
    expect(screen.getByRole("dialog", { name: "调整外观" })).toBeInTheDocument();

    const backdrop = appearanceDialog.parentElement;
    expect(backdrop).not.toBeNull();
    const backdropDismiss = backdrop?.querySelector<HTMLButtonElement>(".dialog-backdrop-dismiss");
    expect(backdropDismiss).not.toBeNull();
    fireEvent.click(backdropDismiss as HTMLButtonElement);
    expect(screen.queryByRole("dialog", { name: "调整外观" })).not.toBeInTheDocument();
  });

  it("applies appearance values to CSS variables immediately", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const update = vi.fn(api.updateAppearance);
    render(<App api={{ ...api, updateAppearance: update }} />);
    fireEvent.click(await screen.findByRole("button", { name: "调整外观" }));

    fireEvent.change(screen.getByRole("slider", { name: /透明度/u }), {
      target: { value: "62" },
    });

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(document.documentElement.style.getPropertyValue("--wallpaper-opacity")).toBe("0.62");
  });

  it("applies temperature and position controls to persisted values and CSS variables", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const update = vi.fn(api.updateAppearance);
    render(<App api={{ ...api, updateAppearance: update }} />);
    fireEvent.click(await screen.findByRole("button", { name: "调整外观" }));

    fireEvent.change(screen.getByRole("slider", { name: /色温/u }), {
      target: { value: "75" },
    });
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ temperature: 50 })),
    );
    expect(
      document.documentElement.style.getPropertyValue("--wallpaper-temperature-filter"),
    ).toContain("sepia");

    fireEvent.change(screen.getByRole("slider", { name: /对比度/u }), {
      target: { value: "0" },
    });
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ contrast: 0 })),
    );
    expect(document.documentElement.style.getPropertyValue("--appearance-contrast")).toBe("50%");

    fireEvent.change(screen.getByRole("slider", { name: /左右移动/u }), {
      target: { value: "75" },
    });
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ positionX: 75 })),
    );
    expect(document.documentElement.style.getPropertyValue("--wallpaper-position-x")).toBe("75%");
    expect(
      Number.parseFloat(document.documentElement.style.getPropertyValue("--wallpaper-offset-x")),
    ).toBeLessThan(-8);

    fireEvent.change(screen.getByRole("slider", { name: /上下移动/u }), {
      target: { value: "25" },
    });
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ positionY: 25 })),
    );
    expect(document.documentElement.style.getPropertyValue("--wallpaper-position-y")).toBe("25%");
    expect(
      Number.parseFloat(document.documentElement.style.getPropertyValue("--wallpaper-offset-y")),
    ).toBeGreaterThan(8);
  });

  it("imports wallpaper from the blank slot area and adjusts sliders with the wheel", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const importWallpaper = vi.fn(api.importWallpaper);
    const update = vi.fn(api.updateAppearance);
    render(<App api={{ ...api, importWallpaper, updateAppearance: update }} />);
    fireEvent.click(await screen.findByRole("button", { name: "调整外观" }));

    expect(screen.getByRole("slider", { name: /透明度/u })).toHaveValue("50");
    expect(screen.getByRole("slider", { name: /模糊度/u })).toHaveValue("0");
    expect(screen.getByRole("slider", { name: /饱和度/u })).toHaveValue("50");

    fireEvent.click(screen.getByRole("button", { name: "选择壁纸 1" }));
    expect(importWallpaper).toHaveBeenCalledWith({ slot: 0 });
    expect(await screen.findByRole("img", { name: "壁纸 1" })).toHaveAttribute(
      "src",
      "dnf-asset://wallpaper/imported-wallpaper.jpg",
    );

    fireEvent.wheel(screen.getByRole("slider", { name: /饱和度/u }), { deltaY: -100 });
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ saturation: 104 })),
    );

    fireEvent.wheel(screen.getByRole("slider", { name: /模糊度/u }), { deltaY: -100 });
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ blur: 1 })),
    );
  });

  it("renders a thumbnail for a populated wallpaper slot", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const initial = await api.getAppearance();
    if (!initial.ok) throw new Error("appearance fixture failed");
    const getAppearance = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...initial.value,
        wallpaper: {
          slots: ["7709850.jpg", null, null, null, null] as [
            string | null,
            string | null,
            string | null,
            string | null,
            string | null,
          ],
          activeSlot: 0,
        },
      },
    });
    render(<App api={{ ...api, getAppearance }} />);

    fireEvent.click(await screen.findByRole("button", { name: "调整外观" }));

    expect(await screen.findByRole("img", { name: "壁纸 1" })).toHaveAttribute(
      "src",
      "dnf-asset://wallpaper/7709850.jpg",
    );
    expect(
      within(screen.getByRole("dialog", { name: "调整外观" })).getAllByTestId(
        "wallpaper-placeholder",
      ),
    ).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "删除壁纸 1" })).toHaveLength(1);
  });

  it("persists a selected theme and restores wallpaper defaults", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const update = vi.fn(api.updateAppearance);
    render(<App api={{ ...api, updateAppearance: update }} />);
    fireEvent.click(await screen.findByRole("button", { name: "调整外观" }));

    fireEvent.click(screen.getByRole("button", { name: "外观主题" }));
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.className.includes("appearance-theme-card")),
    ).toHaveLength(3);
    expect(screen.queryByText("界面颜色")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "透明玻璃" }));
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "glass" })),
    );
    fireEvent.click(screen.getByRole("button", { name: "高对比度" }));
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "high-contrast" })),
    );

    fireEvent.click(screen.getByRole("button", { name: "静态壁纸" }));
    fireEvent.change(screen.getByRole("slider", { name: /透明度/u }), {
      target: { value: "62" },
    });
    fireEvent.click(screen.getByRole("button", { name: "恢复默认" }));

    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        expect.objectContaining({ opacity: 50, theme: "high-contrast" }),
      ),
    );
  });

  it("lets users configure navigation and patch-card colors", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const update = vi.fn(api.updateAppearance);
    render(<App api={{ ...api, updateAppearance: update }} />);
    fireEvent.click(await screen.findByRole("button", { name: "调整外观" }));

    fireEvent.click(screen.getByRole("button", { name: "字体外观" }));

    expect(screen.getByTestId("navigation-font-color-picker")).toBeInTheDocument();
    expect(screen.getByTestId("patch-card-font-color-picker")).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "导航栏色相" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "补丁卡片色相" })).toBeInTheDocument();
    expect(
      within(screen.getByTestId("navigation-font-color-picker")).getByRole("textbox"),
    ).toHaveValue("#F2F4F8");
    expect(
      within(screen.getByTestId("patch-card-font-color-picker")).getByRole("textbox"),
    ).toHaveValue("#F2F4F8");
    expect(screen.queryByText("实时预览")).not.toBeInTheDocument();

    fireEvent.change(
      within(screen.getByTestId("navigation-font-color-picker")).getByRole("textbox"),
      { target: { value: "#12AB34" } },
    );
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        expect.objectContaining({ navigationFontColor: "#12AB34" }),
      ),
    );
    fireEvent.change(
      within(screen.getByTestId("patch-card-font-color-picker")).getByRole("textbox"),
      { target: { value: "#34AB12" } },
    );
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        expect.objectContaining({ patchCardFontColor: "#34AB12" }),
      ),
    );
    expect(document.documentElement.style.getPropertyValue("--navigation-font-color")).toBe(
      "#12AB34",
    );
    expect(document.documentElement.style.getPropertyValue("--patch-card-font-color")).toBe(
      "#34AB12",
    );
    expect(document.documentElement.style.getPropertyValue("--color-text-primary")).toBe("");
    expect(tokensCss).toMatch(/:root\s*\{[\s\S]*color:\s*var\(--color-text-primary\);/u);
  });

  it("supports keyboard editing in the font color bar", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const update = vi.fn(api.updateAppearance);
    render(<App api={{ ...api, updateAppearance: update }} />);
    const appearanceButton = document.querySelector<HTMLElement>(".sidebar-appearance-button");
    expect(appearanceButton).not.toBeNull();
    await waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("halo"));
    fireEvent.click(appearanceButton as HTMLElement);
    const appearanceDialog = screen.getByRole("dialog");
    const appearanceTabs =
      appearanceDialog.querySelectorAll<HTMLButtonElement>(".appearance-nav-button");
    fireEvent.click(appearanceTabs[2] as HTMLButtonElement);

    const picker = screen.getByTestId("navigation-font-color-picker");
    const colorBar = screen.getByRole("slider", { name: "导航栏色相" });
    colorBar.focus();
    expect(document.activeElement).toBe(colorBar);
    fireEvent.keyDown(colorBar, { key: "ArrowRight" });

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.lastCall?.[0].navigationFontColor).not.toBe("#F2F4F8");

    const colorInput = picker.querySelector<HTMLInputElement>('input[type="text"]');
    expect(colorInput).not.toBeNull();
    await waitFor(() => expect(colorInput).not.toHaveValue("#F2F4F8"));
    fireEvent.change(colorInput as HTMLInputElement, { target: { value: "#12AB3" } });
    expect(colorInput).toHaveValue("#12AB3");
    fireEvent.blur(colorInput as HTMLInputElement);
    await waitFor(() => expect(colorInput?.value).toMatch(/^#[A-F0-9]{6}$/u));
    fireEvent.change(colorInput as HTMLInputElement, { target: { value: "#12AB34" } });
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        expect.objectContaining({ navigationFontColor: "#12AB34" }),
      ),
    );
  });

  it("keeps high-contrast text readable when a font color is selected", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const update = vi.fn(api.updateAppearance);
    render(<App api={{ ...api, updateAppearance: update }} />);
    const appearanceButton = document.querySelector<HTMLElement>(".sidebar-appearance-button");
    expect(appearanceButton).not.toBeNull();
    await waitFor(() => expect(document.documentElement.dataset["theme"]).toBe("halo"));
    fireEvent.click(appearanceButton as HTMLElement);

    const appearanceDialog = screen.getByRole("dialog");
    const appearanceTabs =
      appearanceDialog.querySelectorAll<HTMLButtonElement>(".appearance-nav-button");
    fireEvent.click(appearanceTabs[0] as HTMLButtonElement);
    const themeCards =
      appearanceDialog.querySelectorAll<HTMLButtonElement>(".appearance-theme-card");
    fireEvent.click(themeCards[2] as HTMLButtonElement);
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "high-contrast" })),
    );

    fireEvent.click(appearanceTabs[2] as HTMLButtonElement);
    const colorInput = appearanceDialog.querySelector<HTMLInputElement>('input[type="text"]');
    expect(colorInput).not.toBeNull();
    fireEvent.change(colorInput as HTMLInputElement, { target: { value: "#101010" } });
    await waitFor(() =>
      expect(update).toHaveBeenLastCalledWith(
        expect.objectContaining({ navigationFontColor: "#101010" }),
      ),
    );
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue("--navigation-font-color")).toBe(
        "#FFFFFF",
      ),
    );
    expect(document.documentElement.style.getPropertyValue("--patch-card-font-color")).toBe(
      "#FFFFFF",
    );
  });
});

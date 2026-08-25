import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import type { DnfApi } from "../../src/shared/ipc-contracts";
import type { PresetSummary } from "../../src/shared/preset-contracts";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

const PRESET_ID = "0552babf-49b5-4390-96a7-1846a0c1e9f8";

function summary(
  items: PresetSummary["items"],
  missingPaths: readonly string[] = [],
): PresetSummary {
  return {
    id: PRESET_ID,
    name: "测试预设",
    items,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    missingPaths: [...missingPaths],
  };
}

describe("preset workspace", () => {
  it("creates and appends selected patch references, but not groups", async () => {
    const created: Parameters<DnfApi["createPreset"]>[0][] = [];
    const appended: Parameters<DnfApi["addItemsToPreset"]>[0][] = [];
    let presets: PresetSummary[] = [];
    const api: DnfApi = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      listPresets: async () => ({ ok: true, value: presets }),
      createPreset: async (request) => {
        created.push(request);
        const createdPreset = summary(request.items);
        presets = [createdPreset];
        return { ok: true, value: createdPreset };
      },
      addItemsToPreset: async (request) => {
        appended.push(request);
        const existing = presets[0];
        if (existing === undefined) throw new Error("Preset was not created");
        const next = summary([...existing.items, ...request.items]);
        presets = [next];
        return { ok: true, value: next };
      },
    };

    render(<App api={api} />);
    const coat = await screen.findByRole("button", { name: "coat.npk" });
    fireEvent.click(coat);
    fireEvent.click(screen.getByRole("button", { name: "sword.npk" }), {
      ctrlKey: true,
    });
    fireEvent.contextMenu(screen.getByRole("button", { name: "sword.npk" }));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "加入预设" }));
    fireEvent.change(screen.getByRole("textbox", { name: "预设名称" }), {
      target: { value: "测试预设" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建预设" }));

    await waitFor(() => {
      expect(created).toEqual([
        {
          name: "测试预设",
          items: [
            { kind: "patch", relativePath: "coat.npk" },
            { kind: "patch", relativePath: "sword.npk" },
          ],
        },
      ]);
    });

    fireEvent.click(screen.getByRole("button", { name: "coat.npk" }));
    fireEvent.contextMenu(screen.getByRole("button", { name: "coat.npk" }));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "加入预设" }));
    fireEvent.change(screen.getByRole("combobox", { name: "目标预设" }), {
      target: { value: PRESET_ID },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加到预设" }));
    await waitFor(() => {
      expect(appended).toEqual([
        {
          id: PRESET_ID,
          items: [{ kind: "patch", relativePath: "coat.npk" }],
        },
      ]);
    });

    fireEvent.click(screen.getByRole("button", { name: "套装" }));
    expect(screen.queryByRole("button", { name: "加入预设" })).not.toBeInTheDocument();
  });

  it("shows missing references and keeps preset maintenance actions real", async () => {
    let currentPreset: PresetSummary | null = summary(
      [
        { kind: "patch", relativePath: "coat.npk" },
        { kind: "patch", relativePath: "gone.npk" },
      ],
      ["gone.npk"],
    );
    const renamed: Parameters<DnfApi["renamePreset"]>[0][] = [];
    const deleted: Parameters<DnfApi["deletePreset"]>[0][] = [];
    const installed: Parameters<DnfApi["installPreset"]>[0][] = [];
    const api: DnfApi = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      listPresets: async () => ({
        ok: true,
        value: currentPreset === null ? [] : [currentPreset],
      }),
      renamePreset: async (request) => {
        renamed.push(request);
        if (currentPreset === null) throw new Error("Preset was deleted");
        currentPreset = { ...currentPreset, name: request.name };
        return { ok: true, value: currentPreset };
      },
      deletePreset: async (request) => {
        deleted.push(request);
        currentPreset = null;
        return { ok: true, value: { id: request.id } };
      },
      installPreset: async (request) => {
        installed.push(request);
        return { ok: true, value: { installedCount: 1, missingPaths: ["gone.npk"] } };
      },
    };

    render(<App api={api} />);
    const sidebar = await screen.findByRole("navigation", { name: "补丁分类" });
    fireEvent.click(within(sidebar).getByRole("button", { name: "预设" }));
    expect(await screen.findByRole("main", { name: "预设工作区" })).toBeInTheDocument();
    expect(screen.getByText("测试预设")).toBeInTheDocument();
    expect(screen.getByText("缺失 1 项")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看预设 测试预设" }));
    expect(screen.getByText("gone.npk")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "启用预设 测试预设" }));
    await waitFor(() => expect(installed).toEqual([{ id: PRESET_ID }]));

    fireEvent.click(screen.getByRole("button", { name: "重命名预设 测试预设" }));
    fireEvent.change(screen.getByRole("textbox", { name: "预设名称" }), {
      target: { value: "新名称" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    await waitFor(() => expect(renamed).toEqual([{ id: PRESET_ID, name: "新名称" }]));

    fireEvent.click(screen.getByRole("button", { name: "删除预设 新名称" }));
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(deleted).toEqual([{ id: PRESET_ID }]));
  });

  it("keeps the preset switch and patch card switch in sync", async () => {
    let enabled = false;
    const preset = summary([{ kind: "patch", relativePath: "sword.npk" }]);
    const installed: Parameters<DnfApi["installPreset"]>[0][] = [];
    const disabled: Parameters<DnfApi["disableItems"]>[0][] = [];
    const api: DnfApi = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      scan: async () => ({
        ok: true,
        value: {
          ...WORKSPACE_SNAPSHOT,
          patches: WORKSPACE_SNAPSHOT.patches.map((patch) =>
            patch.relativePath === "sword.npk" ? { ...patch, enabled } : patch,
          ),
        },
      }),
      listPresets: async () => ({ ok: true, value: [preset] }),
      installPreset: async (request) => {
        installed.push(request);
        enabled = true;
        return { ok: true, value: { installedCount: 1, missingPaths: [] } };
      },
      disableItems: async (request) => {
        disabled.push(request);
        enabled = false;
        return { ok: true, value: { removedCount: 1 } };
      },
    };

    render(<App api={api} />);
    const sidebar = await screen.findByRole("navigation", { name: "补丁分类" });
    fireEvent.click(within(sidebar).getByRole("button", { name: "预设" }));
    const presetSwitch = await screen.findByRole("checkbox", { name: "启用预设 测试预设" });

    fireEvent.click(presetSwitch);
    await waitFor(() => expect(installed).toEqual([{ id: PRESET_ID }]));
    await waitFor(() => expect(presetSwitch).toBeChecked());

    fireEvent.click(within(sidebar).getByRole("button", { name: "全部" }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "停用 sword.npk" })).toBeChecked(),
    );

    fireEvent.click(within(sidebar).getByRole("button", { name: "预设" }));
    const enabledPresetSwitch = await screen.findByRole("checkbox", {
      name: "停用预设 测试预设",
    });
    fireEvent.click(enabledPresetSwitch);
    await waitFor(() =>
      expect(disabled).toEqual([{ items: [{ kind: "patch", relativePath: "sword.npk" }] }]),
    );

    fireEvent.click(within(sidebar).getByRole("button", { name: "全部" }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "启用 sword.npk" })).not.toBeChecked(),
    );
  });
});

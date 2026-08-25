import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

describe("read-only recovery UI", () => {
  it("shows the corrupt file and disables visible mutation commands", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    render(
      <App
        api={{
          ...api,
          getRecoveryState: async () => ({
            ok: true,
            value: { readOnly: true, files: ["D:\\app\\data\\settings.json"] },
          }),
        }}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("settings.json");
    expect(screen.queryByRole("button", { name: "导入补丁" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择游戏目录" })).not.toBeInTheDocument();
  });
});

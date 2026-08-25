import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

const readProjectFile = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("patch search field contract", () => {
  it("keeps the search control text-only and free of microphone actions", async () => {
    render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);

    const search = await screen.findByRole("searchbox", { name: "搜索补丁" });

    expect(search).toHaveAttribute("type", "search");
    expect(search).toHaveClass("workspace-search-input");
    expect(search.closest("label")).toHaveClass("workspace-search-field");
    expect(screen.queryByRole("button", { name: /麦克风/u })).not.toBeInTheDocument();
  });

  it("keeps the requested compact visual treatment", () => {
    const stylesheet = readProjectFile("src/renderer/styles/layout.css");
    const block = stylesheet.match(/\.workspace-search-field\s*\{[\s\S]*?\n\}/u)?.[0] ?? "";

    expect(block).toContain("max-width: 320px;");
    expect(block).toContain("flex: 0 1 320px;");
    expect(block).toContain(
      "background-color: color-mix(in srgb, var(--color-surface) 62%, transparent);",
    );
    expect(block).not.toContain("#1a1b23");
    expect(block).toContain("border-radius: 2px;");
    expect(stylesheet).toContain(".workspace-search-field:focus-within");
    expect(stylesheet).toContain("border-color: var(--color-primary);");
    expect(stylesheet).toContain("box-shadow: 0 0 0 3px var(--color-focus);");
    expect(stylesheet).not.toContain("rgba(0, 255, 153, 0.35)");
  });

  it("does not ship development overlay dependencies or entry-point injection", () => {
    const entrypoint = readProjectFile("src/renderer/main.tsx");
    const packageManifest = readProjectFile("package.json");

    expect(entrypoint).not.toMatch(/react-(grab|scan)/u);
    expect(packageManifest).not.toMatch(/"react-(grab|scan)"/u);
  });
});

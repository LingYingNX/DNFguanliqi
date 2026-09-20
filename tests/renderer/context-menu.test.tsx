import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

function stubContextMenuRect(size: { width: number; height: number }): void {
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.classList.contains("item-context-menu")) {
      return {
        bottom: size.height,
        height: size.height,
        left: 0,
        right: size.width,
        toJSON: () => ({}),
        top: 0,
        width: size.width,
        x: 0,
        y: 0,
      } as DOMRect;
    }
    return original.call(this);
  });
}

async function openContextMenuAt(clientX: number, clientY: number): Promise<HTMLElement> {
  render(<App api={createFakeApi(WORKSPACE_SNAPSHOT)} />);
  await screen.findByText("coat.npk");
  fireEvent.contextMenu(screen.getByRole("button", { name: /coat\.npk/u }), {
    clientX,
    clientY,
  });
  return screen.getByRole("menu");
}

describe("item context menu placement", () => {
  it("flips upward when there is no room below the cursor", async () => {
    stubContextMenuRect({ width: 150, height: 300 });
    const menu = await openContextMenuAt(100, 760);

    expect(menu).toHaveStyle({ left: "100px", top: "460px" });
  });

  it("opens downward and at the cursor when both sides fit", async () => {
    stubContextMenuRect({ width: 150, height: 300 });
    const menu = await openContextMenuAt(100, 100);

    expect(menu).toHaveStyle({ left: "100px", top: "100px" });
  });

  it("keeps the right edge inside the window when opened near it", async () => {
    stubContextMenuRect({ width: 150, height: 300 });
    const menu = await openContextMenuAt(1000, 100);

    expect(menu).toHaveStyle({ left: "866px", top: "100px" });
  });
});

describe("item context menu dismissal", () => {
  it("closes when the workspace scrolls", async () => {
    const menu = await openContextMenuAt(100, 100);
    expect(menu).toBeVisible();

    const workspace = document.querySelector('main[aria-label="补丁工作区"]');
    expect(workspace).not.toBeNull();
    fireEvent.scroll(workspace as HTMLElement);

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });
});

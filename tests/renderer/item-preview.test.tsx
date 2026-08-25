import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

describe("item previews", () => {
  afterEach(cleanup);
  it("uses a preview-region double click to choose an image", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const selectItemPreview = vi.fn(async () => ({
      ok: true as const,
      value: { previewUrl: "dnf-asset://preview/test.png" },
    }));
    const scan = vi.fn(api.scan);
    const { container } = render(<App api={{ ...api, scan, selectItemPreview }} />);
    const card = await screen.findByRole("button", { name: "coat.npk" });
    const preview = card.querySelector(".item-preview");
    expect(preview).not.toBeNull();

    fireEvent.doubleClick(preview ?? container);

    await waitFor(() =>
      expect(selectItemPreview).toHaveBeenCalledWith({ kind: "patch", relativePath: "coat.npk" }),
    );
    expect(scan).toHaveBeenCalledTimes(2);
  });

  it("renders a hover affordance for every card and zooms only matching previews", async () => {
    const api = createFakeApi({
      ...WORKSPACE_SNAPSHOT,
      patches: WORKSPACE_SNAPSHOT.patches.map((patch) =>
        patch.name === "coat.npk"
          ? { ...patch, previewUrl: "dnf-library://library/coat.png" }
          : patch,
      ),
    });
    render(<App api={api} />);

    const patchCard = await screen.findByRole("button", { name: "coat.npk" });
    const patchShell = patchCard.parentElement;
    expect(patchShell?.querySelector(".item-preview-hover-zone")).toBeInTheDocument();
    expect(patchShell?.querySelector(".item-preview-hover-dot")).toBeInTheDocument();
    expect(patchShell?.querySelector(".item-preview-hover-image")).toHaveAttribute(
      "src",
      "dnf-library://library/coat.png",
    );

    const missingPreviewCard = screen.getByRole("button", { name: "sword.npk" });
    expect(
      missingPreviewCard.parentElement?.querySelector(".item-preview-hover-zone"),
    ).toBeInTheDocument();
    expect(missingPreviewCard.parentElement?.querySelector(".item-preview-hover-image")).toBeNull();
    expect(patchCard).toHaveAttribute("aria-pressed", "false");
  });
});

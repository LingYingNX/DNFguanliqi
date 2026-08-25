import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

describe("descendant category scope", () => {
  it("keeps direct category scope by default and identifies descendant duplicate names when enabled", async () => {
    let dissolveRequest: { readonly groupId: string } | undefined;
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const recursiveSnapshot = {
      ...WORKSPACE_SNAPSHOT,
      groups: [
        ...WORKSPACE_SNAPSHOT.groups,
        {
          kind: "group" as const,
          id: "155552bf-49b5-4390-96a7-1846a0c1e9f8",
          name: "子分类组",
          relativePath: "分类A\\子分类\\组",
          previewRelativePath: null,
          previewUrl: null,
          patchCount: 2,
          createdAt: "2026-07-19T00:00:00.000Z",
          enabled: false,
        },
      ],
      patches: [
        ...WORKSPACE_SNAPSHOT.patches,
        {
          kind: "patch" as const,
          name: "coat.npk",
          relativePath: "分类A\\子分类\\coat.npk",
          previewRelativePath: null,
          previewUrl: null,
          size: 3072,
          modifiedAt: "2026-07-19T00:00:00.000Z",
          enabled: false,
        },
      ],
    };
    const requestedScopes: boolean[] = [];
    render(
      <App
        api={{
          ...api,
          dissolveGroup: async (request) => {
            dissolveRequest = request;
            return { ok: true, value: { id: request.groupId } };
          },
          scan: async (request) => {
            const includeDescendants = request.includeDescendants ?? false;
            requestedScopes.push(includeDescendants);
            return {
              ok: true,
              value: includeDescendants ? recursiveSnapshot : WORKSPACE_SNAPSHOT,
            };
          },
        }}
      />,
    );

    await screen.findByRole("button", { name: "coat.npk" });
    fireEvent.click(screen.getByRole("button", { name: "分类A" }));
    const directCoat = await screen.findByRole("button", { name: /^coat\.npk/u });
    fireEvent.click(directCoat);
    const toggle = screen.getByRole("checkbox", { name: "包含子分类" });
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    expect(toggle).toBeChecked();
    expect(directCoat).toHaveAttribute("aria-pressed", "true");
    expect(requestedScopes).toContain(false);
    expect(requestedScopes.at(-1)).toBe(true);
    expect(
      await screen.findByRole("button", { name: "coat.npk - 分类A\\子分类\\coat.npk" }),
    ).toBeInTheDocument();

    const nestedGroup = await screen.findByRole("button", {
      name: "子分类组 - 分类A\\子分类\\组",
    });
    fireEvent.contextMenu(nestedGroup);
    fireEvent.click(screen.getByRole("menuitem", { name: "解散组" }));

    await waitFor(() =>
      expect(dissolveRequest).toEqual({ groupId: "155552bf-49b5-4390-96a7-1846a0c1e9f8" }),
    );
  });

  it("ignores a stale recursive response after the scope is turned off", async () => {
    const api = createFakeApi(WORKSPACE_SNAPSHOT);
    const recursiveSnapshot = {
      ...WORKSPACE_SNAPSHOT,
      patches: [
        ...WORKSPACE_SNAPSHOT.patches,
        {
          kind: "patch" as const,
          name: "child.npk",
          relativePath: "分类A\\child.npk",
          previewRelativePath: null,
          previewUrl: null,
          size: 1024,
          modifiedAt: "2026-07-19T00:00:00.000Z",
          enabled: false,
        },
      ],
    };
    let finishRecursive: (() => void) | null = null;
    render(
      <App
        api={{
          ...api,
          scan: async (request) => {
            if (request.relativePath === "") {
              return { ok: true, value: WORKSPACE_SNAPSHOT };
            }
            if (!(request.includeDescendants ?? false)) {
              return { ok: true, value: WORKSPACE_SNAPSHOT };
            }
            return new Promise((resolve) => {
              finishRecursive = () => resolve({ ok: true, value: recursiveSnapshot });
            });
          },
        }}
      />,
    );
    await screen.findByRole("button", { name: /^coat\.npk/u });
    fireEvent.click(screen.getByRole("button", { name: "分类A" }));
    await screen.findByRole("button", { name: /^coat\.npk/u });
    const toggle = screen.getByRole("checkbox", { name: "包含子分类" });

    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await screen.findByRole("button", { name: /^coat\.npk/u });
    if (finishRecursive === null) throw new Error("Recursive scan did not start");
    await act(async () => finishRecursive?.());

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "child.npk - 分类A\\child.npk" })).toBeNull();
    });
  });
});

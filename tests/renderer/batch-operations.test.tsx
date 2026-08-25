import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";
import type { DnfApi } from "../../src/shared/ipc-contracts";
import { createFakeApi, WORKSPACE_SNAPSHOT } from "./fake-api";

afterEach(cleanup);

describe("atomic workspace operations", () => {
  it("uses the batch enable API behind an individual card switch", async () => {
    const requests: Array<Parameters<DnfApi["enableItems"]>[0]> = [];
    let singleCalls = 0;
    const api: DnfApi = {
      ...createFakeApi(WORKSPACE_SNAPSHOT),
      enableItems: async (request) => {
        requests.push(request);
        return { ok: true, value: { installedCount: 1 } };
      },
      enableItem: async () => {
        singleCalls += 1;
        return { ok: true, value: { installedCount: 1 } };
      },
    };
    render(<App api={api} />);
    await screen.findByText("coat.npk");
    fireEvent.click(screen.getByRole("checkbox", { name: "启用 sword.npk" }));

    // Then: only one typed batch request crosses the renderer boundary.
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toEqual({ items: [{ kind: "patch", relativePath: "sword.npk" }] });
    expect(singleCalls).toBe(0);
  });
});

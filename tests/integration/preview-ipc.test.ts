import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BrowserWindow } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AsyncMutex } from "../../src/core/concurrency/async-mutex";
import type { PreviewService } from "../../src/core/previews/preview-service";
import { resolveAppPaths } from "../../src/main/app-paths";
import { registerPreviewIpc } from "../../src/main/ipc/preview-ipc";
import { registerIpc } from "../../src/main/ipc/register-ipc";
import { apiResultSchema, IPC_CHANNELS } from "../../src/shared/ipc-contracts";

const GroupResultSchema = apiResultSchema(
  z.object({ id: z.string().uuid(), categoryRelativePath: z.string() }),
);

const electronMocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  showOpenDialog: vi.fn(),
}));

vi.mock("electron", () => ({
  dialog: { showOpenDialog: electronMocks.showOpenDialog },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      electronMocks.handlers.set(channel, handler);
    },
    removeHandler: (channel: string) => {
      electronMocks.handlers.delete(channel);
    },
  },
}));

const temporaryDirectories: string[] = [];

afterEach(async () => {
  electronMocks.handlers.clear();
  electronMocks.showOpenDialog.mockReset();
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("preview selection IPC", () => {
  it("migrates legacy patch previews into the patch directory during startup", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-preview-ipc-migration-"));
    temporaryDirectories.push(projectRoot);
    const paths = resolveAppPaths({ mode: "development", projectRoot });
    const category = join(paths.libraryRoot, "Armor");
    const assetName = "01234567-89ab-4cde-8fab-0123456789ab.png";
    await Promise.all([
      mkdir(category, { recursive: true }),
      mkdir(join(paths.dataRoot, "previews"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(category, "coat.npk"), "patch"),
      writeFile(join(paths.dataRoot, "previews", assetName), "legacy preview"),
      writeFile(
        join(paths.dataRoot, "previews.json"),
        JSON.stringify({
          formatVersion: 1,
          bindings: [
            {
              state: "active",
              kind: "patch",
              relativePath: "Armor\\coat.npk",
              assetName,
            },
          ],
        }),
      ),
    ]);
    const window = {
      close: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => false),
      maximize: vi.fn(),
      minimize: vi.fn(),
      on: vi.fn(),
      unmaximize: vi.fn(),
      webContents: { send: vi.fn() },
    } as unknown as BrowserWindow;

    await registerIpc(window, paths, false);

    await expect(readFile(join(category, "coat.png"), "utf8")).resolves.toBe("legacy preview");
    await expect(access(join(paths.dataRoot, "previews", assetName))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(JSON.parse(await readFile(join(paths.dataRoot, "previews.json"), "utf8"))).toEqual({
      formatVersion: 1,
      bindings: [],
    });
  });

  it("copies a selected patch preview beside the patch instead of the managed previews folder", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-preview-ipc-library-"));
    temporaryDirectories.push(projectRoot);
    const paths = resolveAppPaths({ mode: "development", projectRoot });
    const category = join(paths.libraryRoot, "Armor");
    const source = join(projectRoot, "selected.png");
    await mkdir(category, { recursive: true });
    await Promise.all([
      writeFile(join(category, "A.npk"), "patch"),
      writeFile(join(category, "other.png"), "keep"),
      writeFile(source, "new preview"),
    ]);
    electronMocks.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [source],
    });
    const window = {
      close: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => false),
      maximize: vi.fn(),
      minimize: vi.fn(),
      on: vi.fn(),
      unmaximize: vi.fn(),
      webContents: { send: vi.fn() },
    } as unknown as BrowserWindow;

    await registerIpc(window, paths, false);
    const select = electronMocks.handlers.get(IPC_CHANNELS.selectItemPreview);
    if (select === undefined) throw new Error("select handler was not registered");

    await expect(
      select(undefined, { kind: "patch", relativePath: "Armor\\A.npk" }),
    ).resolves.toEqual({
      ok: true,
      value: { previewUrl: "dnf-library://library/Armor%5CA.png" },
    });
    expect(await readFile(join(category, "A.png"), "utf8")).toBe("new preview");
    expect(await readFile(join(category, "other.png"), "utf8")).toBe("keep");
    await expect(access(join(paths.dataRoot, "previews"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("binds patch and group selections through the managed preview service", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-preview-ipc-"));
    temporaryDirectories.push(projectRoot);
    const patchSource = join(projectRoot, "patch.png");
    const groupSource = join(projectRoot, "group.jpg");
    await Promise.all([
      writeFile(patchSource, "patch preview"),
      writeFile(groupSource, "group preview"),
    ]);

    electronMocks.showOpenDialog
      .mockResolvedValueOnce({ canceled: false, filePaths: [patchSource] })
      .mockResolvedValueOnce({ canceled: false, filePaths: [groupSource] });
    const set = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: { previewUrl: "dnf-asset://preview/patch-preview.png" },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { previewUrl: "dnf-asset://preview/group-preview.jpg" },
      });
    const previews = { listActive: vi.fn(), set } as unknown as PreviewService;
    const mutationMutex: AsyncMutex = { runExclusive: (action) => action() };
    registerPreviewIpc({
      mutationMutex,
      previews,
      window: {} as BrowserWindow,
    });
    const select = electronMocks.handlers.get(IPC_CHANNELS.selectItemPreview);
    if (select === undefined) throw new Error("select handler was not registered");

    await expect(
      select(undefined, { kind: "patch", relativePath: "Armor\\A.npk" }),
    ).resolves.toEqual({
      ok: true,
      value: { previewUrl: "dnf-asset://preview/patch-preview.png" },
    });
    await expect(
      select(undefined, {
        kind: "group",
        groupId: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
      }),
    ).resolves.toEqual({
      ok: true,
      value: { previewUrl: "dnf-asset://preview/group-preview.jpg" },
    });
    expect(set).toHaveBeenNthCalledWith(1, {
      kind: "patch",
      relativePath: "Armor\\A.npk",
      sourcePath: patchSource,
    });
    expect(set).toHaveBeenNthCalledWith(2, {
      kind: "group",
      groupId: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
      sourcePath: groupSource,
    });
  });

  it("creates and dissolves a virtual group without moving NPK files", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-group-ipc-"));
    temporaryDirectories.push(projectRoot);
    const paths = resolveAppPaths({ mode: "development", projectRoot });
    const category = join(paths.libraryRoot, "Armor");
    await mkdir(category, { recursive: true });
    await Promise.all([
      writeFile(join(category, "a.npk"), "a"),
      writeFile(join(category, "b.npk"), "b"),
    ]);
    const window = {
      close: vi.fn(),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => false),
      maximize: vi.fn(),
      minimize: vi.fn(),
      on: vi.fn(),
      unmaximize: vi.fn(),
      webContents: { send: vi.fn() },
    } as unknown as BrowserWindow;

    await registerIpc(window, paths, false);
    const create = electronMocks.handlers.get(IPC_CHANNELS.createGroup);
    const dissolve = electronMocks.handlers.get(IPC_CHANNELS.dissolveGroup);
    if (create === undefined || dissolve === undefined)
      throw new Error("group handlers were not registered");

    const created = GroupResultSchema.safeParse(
      await create(undefined, {
        categoryRelativePath: "Armor",
        patchRelativePaths: ["Armor\\a.npk", "Armor\\b.npk"],
        groupName: "Bundle",
      }),
    );
    if (!created.success || !created.data.ok) {
      throw new Error("Expected virtual group creation to succeed");
    }
    expect(created.data).toMatchObject({
      ok: true,
      value: { id: expect.any(String), categoryRelativePath: "Armor" },
    });
    const groupId = created.data.value.id;
    await expect(readFile(join(category, "a.npk"), "utf8")).resolves.toBe("a");
    await expect(readFile(join(category, "b.npk"), "utf8")).resolves.toBe("b");
    await expect(access(join(category, "Bundle"))).rejects.toMatchObject({ code: "ENOENT" });

    await writeFile(
      join(paths.dataRoot, "previews.json"),
      JSON.stringify({
        formatVersion: 1,
        bindings: [
          {
            state: "active",
            kind: "group",
            groupId,
            assetName: "group-preview.png",
          },
        ],
      }),
    );
    await expect(dissolve(undefined, { groupId })).resolves.toEqual({
      ok: true,
      value: { id: groupId },
    });
    await expect(readFile(join(category, "a.npk"), "utf8")).resolves.toBe("a");
    await expect(readFile(join(category, "b.npk"), "utf8")).resolves.toBe("b");
    expect(JSON.parse(await readFile(join(paths.dataRoot, "groups.json"), "utf8"))).toMatchObject({
      groups: [],
    });
    expect(JSON.parse(await readFile(join(paths.dataRoot, "previews.json"), "utf8"))).toMatchObject(
      {
        bindings: [],
      },
    );
  });
});

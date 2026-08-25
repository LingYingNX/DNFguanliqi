import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLibraryLifecycleService } from "../../src/core/application/library-lifecycle-service";
import { createManagedImageAssets } from "../../src/core/assets/managed-image-assets";
import { executeFileTransaction } from "../../src/core/filesystem/file-transaction";
import {
  createVirtualGroupService,
  type VirtualGroupService,
} from "../../src/core/groups/group-service";
import { createInstallService } from "../../src/core/install/install-service";
import { moveLibraryItem } from "../../src/core/library/move-library-item";
import { createPreviewService } from "../../src/core/previews/preview-service";
import { createPreviewStateStore } from "../../src/core/previews/preview-state";
import { createRecycleService } from "../../src/core/recycle/recycle-service";
import { parseGameRoot, resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];
const previewId = "01234567-89ab-4cde-8fab-0123456789ab";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "dnf-preview-move-"));
  temporaryDirectories.push(root);
  const paths = resolveAppPaths({ mode: "development", projectRoot: root });
  const gameRoot = parseGameRoot(join(root, "game"));
  const previewIds = [previewId, "11234567-89ab-4cde-8fab-0123456789ab"];
  let previewIndex = 0;
  await Promise.all([
    mkdir(join(paths.libraryRoot, "Source"), { recursive: true }),
    mkdir(join(paths.libraryRoot, "Target"), { recursive: true }),
    mkdir(paths.dataRoot, { recursive: true }),
    mkdir(gameRoot),
  ]);
  const previews = createPreviewService({
    assets: createManagedImageAssets({
      assetsRoot: join(paths.dataRoot, "previews"),
      createId: () => previewIds[previewIndex++] ?? crypto.randomUUID(),
      kind: "preview",
    }),
    store: createPreviewStateStore(join(paths.dataRoot, "previews.json")),
  });
  const install = createInstallService({ ...paths, gameRoot });
  const lifecycle = (executeTransaction = executeFileTransaction, groups?: VirtualGroupService) =>
    createLibraryLifecycleService({
      groups,
      libraryRoot: paths.libraryRoot,
      install,
      previews,
      recycle: createRecycleService(paths),
      executeTransaction,
    });
  return { gameRoot, install, lifecycle, paths, previews };
}

describe("preview move lifecycle", () => {
  it("moves a patch preview binding with the library item", async () => {
    const { lifecycle, paths, previews } = await createFixture();
    const source = join(paths.libraryRoot, "Source", "coat.npk");
    const image = join(paths.dataRoot, "source.png");
    await Promise.all([writeFile(source, "patch"), writeFile(image, "preview")]);
    await previews.set({ kind: "patch", relativePath: "Source\\coat.npk", sourcePath: image });

    const result = await lifecycle().moveMany({
      items: [{ kind: "patch", sourceRelativePath: "Source\\coat.npk" }],
      targetDirectoryRelativePath: "Target",
    });

    expect(result).toEqual({ ok: true, value: { relativePaths: ["Target\\coat.npk"] } });
    expect(await previews.listActive()).toEqual({
      ok: true,
      value: [
        {
          kind: "patch",
          relativePath: "Target\\coat.npk",
          previewUrl: `dnf-asset://preview/${previewId}.png`,
        },
      ],
    });
  });

  it("moves a same-name library preview file with the patch", async () => {
    const { paths } = await createFixture();
    const source = join(paths.libraryRoot, "Source", "coat.npk");
    const preview = join(paths.libraryRoot, "Source", "coat.png");
    await Promise.all([writeFile(source, "patch"), writeFile(preview, "preview")]);

    const result = await moveLibraryItem({
      libraryRoot: paths.libraryRoot,
      kind: "patch",
      sourceRelativePath: "Source\\coat.npk",
      targetDirectoryRelativePath: "Target",
    });

    expect(result).toEqual({ ok: true, value: { relativePath: "Target\\coat.npk" } });
    await expect(readFile(join(paths.libraryRoot, "Target", "coat.png"), "utf8")).resolves.toBe(
      "preview",
    );
    await expect(access(join(paths.libraryRoot, "Source", "coat.png"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps a virtual group preview binding when the group moves", async () => {
    const { paths, previews } = await createFixture();
    const image = join(paths.dataRoot, "source.png");
    await Promise.all([
      writeFile(join(paths.libraryRoot, "Source", "coat.npk"), "coat"),
      writeFile(join(paths.libraryRoot, "Source", "sword.npk"), "sword"),
      writeFile(image, "preview"),
    ]);
    const groupId = "0552babf-49b5-4390-96a7-1846a0c1e9f8";
    const groups = createVirtualGroupService({
      dataRoot: paths.dataRoot,
      libraryRoot: paths.libraryRoot,
      createId: () => groupId,
    });
    await groups.create({
      categoryRelativePath: "Source",
      memberRelativePaths: ["Source\\coat.npk", "Source\\sword.npk"],
      name: "Set",
    });
    await previews.set({ kind: "group", groupId, sourcePath: image });

    const result = await moveLibraryItem(
      {
        libraryRoot: paths.libraryRoot,
        kind: "group",
        groupId,
        targetDirectoryRelativePath: "Target",
      },
      { groups },
    );

    expect(result).toEqual({ ok: true, value: { relativePath: groupId } });
    expect(await previews.listActive()).toEqual({
      ok: true,
      value: [{ kind: "group", groupId, previewUrl: `dnf-asset://preview/${previewId}.png` }],
    });
  });

  it("rolls back the preview path when a later lifecycle step fails", async () => {
    const { lifecycle, paths, previews } = await createFixture();
    const source = join(paths.libraryRoot, "Source", "coat.npk");
    const image = join(paths.dataRoot, "source.png");
    await Promise.all([writeFile(source, "patch"), writeFile(image, "preview")]);
    await previews.set({ kind: "patch", relativePath: "Source\\coat.npk", sourcePath: image });

    const result = await lifecycle(async (steps) =>
      executeFileTransaction([
        ...steps,
        {
          apply: async () => {
            throw new Error("injected failure");
          },
          compensate: async () => {},
        },
      ]),
    ).moveMany({
      items: [{ kind: "patch", sourceRelativePath: "Source\\coat.npk" }],
      targetDirectoryRelativePath: "Target",
    });

    expect(result).toEqual({ ok: false, error: { code: "TRANSACTION_FAILED" } });
    await expect(access(source)).resolves.toBeUndefined();
    await expect(access(join(paths.libraryRoot, "Target", "coat.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await previews.listActive()).toMatchObject({
      ok: true,
      value: [{ relativePath: "Source\\coat.npk" }],
    });
  });

  it("moves a recycled preview binding away from the old library path", async () => {
    const { lifecycle, paths, previews } = await createFixture();
    const source = join(paths.libraryRoot, "Source", "coat.npk");
    const image = join(paths.dataRoot, "source.png");
    await Promise.all([writeFile(source, "patch"), writeFile(image, "preview")]);
    await previews.set({ kind: "patch", relativePath: "Source\\coat.npk", sourcePath: image });

    const result = await lifecycle().recycle({ kind: "patch", relativePath: "Source\\coat.npk" });

    expect(result.ok).toBe(true);
    expect(await previews.listActive()).toEqual({ ok: true, value: [] });
    const state = await previews.read();
    expect(state.ok ? state.value.bindings[0] : state).toMatchObject({
      state: "recycled",
      recycleEntryId: result.ok ? result.value.entry.id : "missing",
    });
  });

  it("dissolves a virtual group without moving NPK files or patch previews", async () => {
    const { lifecycle, paths, previews } = await createFixture();
    const groupImage = join(paths.dataRoot, "group.png");
    const patchImage = join(paths.dataRoot, "patch.png");
    const groupId = "0552babf-49b5-4390-96a7-1846a0c1e9f8";
    const groups = createVirtualGroupService({
      dataRoot: paths.dataRoot,
      libraryRoot: paths.libraryRoot,
      createId: () => groupId,
    });
    await Promise.all([
      writeFile(join(paths.libraryRoot, "Source", "coat.npk"), "coat"),
      writeFile(join(paths.libraryRoot, "Source", "sword.npk"), "sword"),
      writeFile(groupImage, "group-preview"),
      writeFile(patchImage, "patch-preview"),
    ]);
    const created = await groups.create({
      categoryRelativePath: "Source",
      memberRelativePaths: ["Source\\coat.npk", "Source\\sword.npk"],
      name: "Set",
    });
    if (!created.ok) throw new Error("Expected virtual group creation to succeed");
    await previews.set({ kind: "group", groupId, sourcePath: groupImage });
    await previews.set({
      kind: "patch",
      relativePath: "Source\\coat.npk",
      sourcePath: patchImage,
    });

    const result = await lifecycle(executeFileTransaction, groups).dissolveGroup({ groupId });

    expect(result).toEqual({ ok: true, value: { id: groupId } });
    await expect(readFile(join(paths.libraryRoot, "Source", "coat.npk"), "utf8")).resolves.toBe(
      "coat",
    );
    await expect(readFile(join(paths.libraryRoot, "Source", "sword.npk"), "utf8")).resolves.toBe(
      "sword",
    );
    await expect(access(join(paths.libraryRoot, "Source", "Set"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await groups.list()).toEqual({ ok: true, value: { formatVersion: 1, groups: [] } });
    expect(await previews.listActive()).toEqual({
      ok: true,
      value: [
        {
          kind: "patch",
          relativePath: "Source\\coat.npk",
          previewUrl: "dnf-asset://preview/11234567-89ab-4cde-8fab-0123456789ab.png",
        },
      ],
    });
    expect(await previews.read()).toEqual({
      ok: true,
      value: {
        formatVersion: 1,
        bindings: [
          {
            state: "active",
            kind: "patch",
            relativePath: "Source\\coat.npk",
            assetName: "11234567-89ab-4cde-8fab-0123456789ab.png",
          },
        ],
      },
    });
  });

  it("reactivates a preview binding when its recycle entry is restored", async () => {
    const { lifecycle, paths, previews } = await createFixture();
    const source = join(paths.libraryRoot, "Source", "coat.npk");
    const image = join(paths.dataRoot, "source.png");
    await Promise.all([writeFile(source, "patch"), writeFile(image, "preview")]);
    await previews.set({ kind: "patch", relativePath: "Source\\coat.npk", sourcePath: image });
    const recycled = await lifecycle().recycle({
      kind: "patch",
      relativePath: "Source\\coat.npk",
    });
    if (!recycled.ok) throw new Error("Expected recycle to succeed");

    const restored = await createRecycleService({ ...paths, previews }).restore({
      id: recycled.value.entry.id,
    });

    expect(restored).toEqual({ ok: true, value: { relativePath: "Source\\coat.npk" } });
    expect(await previews.listActive()).toMatchObject({
      ok: true,
      value: [{ kind: "patch", relativePath: "Source\\coat.npk" }],
    });
  });

  it("keeps a same-name library preview while a patch is recycled and restores it with the patch", async () => {
    const { lifecycle, paths, previews } = await createFixture();
    const source = join(paths.libraryRoot, "Source", "coat.npk");
    const preview = join(paths.libraryRoot, "Source", "coat.png");
    await Promise.all([writeFile(source, "patch"), writeFile(preview, "preview")]);

    const recycled = await lifecycle().recycle({
      kind: "patch",
      relativePath: "Source\\coat.npk",
    });
    expect(recycled.ok).toBe(true);
    await expect(access(source)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(preview, "utf8")).resolves.toBe("preview");

    const restored = await createRecycleService({ ...paths, previews }).restore({
      id: recycled.ok ? recycled.value.entry.id : "missing",
    });

    expect(restored).toEqual({ ok: true, value: { relativePath: "Source\\coat.npk" } });
    await expect(readFile(source, "utf8")).resolves.toBe("patch");
    await expect(readFile(preview, "utf8")).resolves.toBe("preview");
  });
});

import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLibraryLifecycleService } from "../../src/core/application/library-lifecycle-service";
import { createManagedImageAssets } from "../../src/core/assets/managed-image-assets";
import { executeFileTransaction } from "../../src/core/filesystem/file-transaction";
import { createVirtualGroupService } from "../../src/core/groups/group-service";
import { createInstallService } from "../../src/core/install/install-service";
import { createPreviewService } from "../../src/core/previews/preview-service";
import { createPreviewStateStore } from "../../src/core/previews/preview-state";
import { createRecycleService } from "../../src/core/recycle/recycle-service";
import { parseGameRoot, resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function createLifecycleFixture(): Promise<{
  readonly paths: ReturnType<typeof resolveAppPaths>;
  readonly gameRoot: ReturnType<typeof parseGameRoot>;
}> {
  const projectRoot = await mkdtemp(join(tmpdir(), "dnf-lifecycle-"));
  temporaryDirectories.push(projectRoot);
  const paths = resolveAppPaths({ mode: "development", projectRoot });
  const gameDirectory = join(projectRoot, "game");
  await Promise.all([
    mkdir(join(paths.libraryRoot, "分类A"), { recursive: true }),
    mkdir(join(paths.libraryRoot, "分类B"), { recursive: true }),
    mkdir(paths.dataRoot, { recursive: true }),
    mkdir(gameDirectory),
  ]);
  return { paths, gameRoot: parseGameRoot(gameDirectory) };
}

describe("library lifecycle service", () => {
  it("recycles every selected item and disables all installed targets atomically", async () => {
    const { paths, gameRoot } = await createLifecycleFixture();
    await Promise.all([
      writeFile(join(paths.libraryRoot, "分类A", "coat.npk"), "coat"),
      writeFile(join(paths.libraryRoot, "分类A", "sword.npk"), "sword"),
    ]);
    const install = createInstallService({ ...paths, gameRoot });
    await install.enableMany([
      { kind: "patch", relativePath: "分类A\\coat.npk" },
      { kind: "patch", relativePath: "分类A\\sword.npk" },
    ]);
    const ids = ["a2021aa5-e024-4106-a0a3-f0874d4c9ec9", "bbfa906c-b853-4424-b053-11b21e364f4b"];
    const lifecycle = createLibraryLifecycleService({
      libraryRoot: paths.libraryRoot,
      install,
      recycle: createRecycleService({
        ...paths,
        createId: () => ids.shift() ?? crypto.randomUUID(),
      }),
    });

    const result = await lifecycle.recycleMany([
      { kind: "patch", relativePath: "分类A\\coat.npk" },
      { kind: "patch", relativePath: "分类A\\sword.npk" },
    ]);

    expect(result.ok).toBe(true);
    await expect(access(join(paths.libraryRoot, "分类A", "coat.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(paths.libraryRoot, "分类A", "sword.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(gameRoot, "coat.npk"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(gameRoot, "sword.npk"))).rejects.toMatchObject({ code: "ENOENT" });
    const installation = JSON.parse(
      await readFile(join(paths.dataRoot, "installation-state.json"), "utf8"),
    );
    const recycleManifest = JSON.parse(
      await readFile(join(paths.dataRoot, "recycle-bin.json"), "utf8"),
    );
    expect(installation.records).toEqual([]);
    expect(recycleManifest.items).toHaveLength(2);
  });

  it("restores every boundary when an atomic batch recycle fails", async () => {
    // Given: two enabled patches and one lifecycle transaction that fails before state commits.
    const { paths, gameRoot } = await createLifecycleFixture();
    await Promise.all([
      writeFile(join(paths.libraryRoot, "分类A", "coat.npk"), "coat"),
      writeFile(join(paths.libraryRoot, "分类A", "sword.npk"), "sword"),
    ]);
    const install = createInstallService({ ...paths, gameRoot });
    await install.enableMany([
      { kind: "patch", relativePath: "分类A\\coat.npk" },
      { kind: "patch", relativePath: "分类A\\sword.npk" },
    ]);
    const installationState = join(paths.dataRoot, "installation-state.json");
    const beforeState = await readFile(installationState);
    const lifecycle = createLibraryLifecycleService({
      libraryRoot: paths.libraryRoot,
      install,
      recycle: createRecycleService({
        ...paths,
        createId: (() => {
          const ids = [
            "a2021aa5-e024-4106-a0a3-f0874d4c9ec9",
            "bbfa906c-b853-4424-b053-11b21e364f4b",
          ];
          return () => ids.shift() ?? crypto.randomUUID();
        })(),
      }),
      executeTransaction: async (steps) =>
        executeFileTransaction([
          ...steps.slice(0, -2),
          {
            apply: async () => {
              throw new Error("injected batch recycle failure");
            },
            compensate: async () => {},
          },
          ...steps.slice(-2),
        ]),
    });

    // When: both selected patches are recycled as one command.
    const result = await lifecycle.recycleMany([
      { kind: "patch", relativePath: "分类A\\coat.npk" },
      { kind: "patch", relativePath: "分类A\\sword.npk" },
    ]);

    // Then: library, game and persisted state remain exactly as before.
    expect(result).toEqual({ ok: false, error: { code: "TRANSACTION_FAILED" } });
    expect(await readFile(join(paths.libraryRoot, "分类A", "coat.npk"), "utf8")).toBe("coat");
    expect(await readFile(join(paths.libraryRoot, "分类A", "sword.npk"), "utf8")).toBe("sword");
    expect(await readFile(join(gameRoot, "coat.npk"), "utf8")).toBe("coat");
    expect(await readFile(join(gameRoot, "sword.npk"), "utf8")).toBe("sword");
    expect(await readFile(installationState)).toEqual(beforeState);
    await expect(access(join(paths.dataRoot, "recycle-bin.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("moves every selected library item and installed record atomically", async () => {
    const { paths, gameRoot } = await createLifecycleFixture();
    await Promise.all([
      writeFile(join(paths.libraryRoot, "分类A", "coat.npk"), "coat"),
      writeFile(join(paths.libraryRoot, "分类A", "sword.npk"), "sword"),
    ]);
    const install = createInstallService({ ...paths, gameRoot });
    await install.enableMany([
      { kind: "patch", relativePath: "分类A\\coat.npk" },
      { kind: "patch", relativePath: "分类A\\sword.npk" },
    ]);
    const lifecycle = createLibraryLifecycleService({
      libraryRoot: paths.libraryRoot,
      install,
      recycle: createRecycleService(paths),
    });

    const result = await lifecycle.moveMany({
      items: [
        { kind: "patch", sourceRelativePath: "分类A\\coat.npk" },
        { kind: "patch", sourceRelativePath: "分类A\\sword.npk" },
      ],
      targetDirectoryRelativePath: "分类B",
    });

    expect(result).toEqual({
      ok: true,
      value: { relativePaths: ["分类B\\coat.npk", "分类B\\sword.npk"] },
    });
    expect(await readFile(join(paths.libraryRoot, "分类B", "coat.npk"), "utf8")).toBe("coat");
    expect(await readFile(join(paths.libraryRoot, "分类B", "sword.npk"), "utf8")).toBe("sword");
    const state = JSON.parse(
      await readFile(join(paths.dataRoot, "installation-state.json"), "utf8"),
    );
    expect(
      state.records.map((record: { sourceRelativePath: string }) => record.sourceRelativePath),
    ).toEqual(["分类B\\coat.npk", "分类B\\sword.npk"]);
  });

  it("restores library, game and state when a batch move transaction fails", async () => {
    // Given: two enabled patches and one transaction that fails after all file moves.
    const { paths, gameRoot } = await createLifecycleFixture();
    await Promise.all([
      writeFile(join(paths.libraryRoot, "分类A", "coat.npk"), "coat"),
      writeFile(join(paths.libraryRoot, "分类A", "sword.npk"), "sword"),
    ]);
    const setup = createInstallService({ ...paths, gameRoot });
    await setup.enableMany([
      { kind: "patch", relativePath: "分类A\\coat.npk" },
      { kind: "patch", relativePath: "分类A\\sword.npk" },
    ]);
    const statePath = join(paths.dataRoot, "installation-state.json");
    const beforeState = await readFile(statePath);
    const install = createInstallService({ ...paths, gameRoot });
    const lifecycle = createLibraryLifecycleService({
      libraryRoot: paths.libraryRoot,
      install,
      recycle: createRecycleService(paths),
      executeTransaction: async (steps) =>
        executeFileTransaction([
          ...steps.slice(0, -1),
          {
            apply: async () => {
              throw new Error("injected lifecycle failure");
            },
            compensate: async () => {},
          },
        ]),
    });

    // When: one batch lifecycle command moves both selected patches.
    const result = await lifecycle.moveMany({
      items: [
        { kind: "patch", sourceRelativePath: "分类A\\coat.npk" },
        { kind: "patch", sourceRelativePath: "分类A\\sword.npk" },
      ],
      targetDirectoryRelativePath: "分类B",
    });

    // Then: every filesystem and persisted-state boundary is restored exactly.
    expect(result).toEqual({ ok: false, error: { code: "TRANSACTION_FAILED" } });
    expect(await readFile(join(paths.libraryRoot, "分类A", "coat.npk"), "utf8")).toBe("coat");
    expect(await readFile(join(paths.libraryRoot, "分类A", "sword.npk"), "utf8")).toBe("sword");
    await expect(access(join(paths.libraryRoot, "分类B", "coat.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(gameRoot, "coat.npk"), "utf8")).toBe("coat");
    expect(await readFile(join(gameRoot, "sword.npk"), "utf8")).toBe("sword");
    expect(await readFile(statePath)).toEqual(beforeState);
  });

  it("renames an enabled patch without leaving its old game file or record", async () => {
    const { paths, gameRoot } = await createLifecycleFixture();
    await writeFile(join(paths.libraryRoot, "分类A", "coat.npk"), "coat");
    const install = createInstallService({ ...paths, gameRoot });
    const recycle = createRecycleService({ ...paths });
    const lifecycle = createLibraryLifecycleService({
      libraryRoot: paths.libraryRoot,
      install,
      recycle,
    });
    await install.enable({ kind: "patch", relativePath: "分类A\\coat.npk" });

    const result = await lifecycle.move({
      kind: "patch",
      sourceRelativePath: "分类A\\coat.npk",
      targetDirectoryRelativePath: "分类B",
      newName: "jacket.npk",
    });

    expect(result).toEqual({ ok: true, value: { relativePath: "分类B\\jacket.npk" } });
    await expect(access(join(paths.libraryRoot, "分类A", "coat.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(gameRoot, "coat.npk"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(gameRoot, "jacket.npk"), "utf8")).toBe("coat");
    const state = JSON.parse(
      await readFile(join(paths.dataRoot, "installation-state.json"), "utf8"),
    );
    expect(state.records[0]).toMatchObject({
      sourceRelativePath: "分类B\\jacket.npk",
      targetPath: join(gameRoot, "jacket.npk"),
    });
  });

  it("aborts recycling when safe disable detects an external modification", async () => {
    const { paths, gameRoot } = await createLifecycleFixture();
    const source = join(paths.libraryRoot, "分类A", "coat.npk");
    await writeFile(source, "coat");
    const install = createInstallService({ ...paths, gameRoot });
    const recycle = createRecycleService({ ...paths });
    const lifecycle = createLibraryLifecycleService({
      libraryRoot: paths.libraryRoot,
      install,
      recycle,
    });
    await install.enable({ kind: "patch", relativePath: "分类A\\coat.npk" });
    await writeFile(join(gameRoot, "coat.npk"), "external-change");

    const result = await lifecycle.recycle({ kind: "patch", relativePath: "分类A\\coat.npk" });

    expect(result).toEqual({
      ok: false,
      error: { code: "TARGET_MODIFIED", targetPath: join(gameRoot, "coat.npk") },
    });
    expect(await readFile(source, "utf8")).toBe("coat");
    expect(await readFile(join(gameRoot, "coat.npk"), "utf8")).toBe("external-change");
    const state = JSON.parse(
      await readFile(join(paths.dataRoot, "installation-state.json"), "utf8"),
    );
    expect(state.records).toHaveLength(1);
  });

  it("recycles a virtual group with its installation records and preview atomically", async () => {
    const { paths, gameRoot } = await createLifecycleFixture();
    await Promise.all([
      writeFile(join(paths.libraryRoot, "分类A", "coat.npk"), "coat"),
      writeFile(join(paths.libraryRoot, "分类A", "sword.npk"), "sword"),
    ]);
    const groupId = "0552babf-49b5-4390-96a7-1846a0c1e9f8";
    const groups = createVirtualGroupService({
      dataRoot: paths.dataRoot,
      libraryRoot: paths.libraryRoot,
      createId: () => groupId,
    });
    const created = await groups.create({
      categoryRelativePath: "分类A",
      memberRelativePaths: ["分类A\\coat.npk", "分类A\\sword.npk"],
      name: "套装",
    });
    if (!created.ok) throw new Error("Expected virtual group creation to succeed");
    const install = createInstallService({ ...paths, gameRoot, groups });
    await expect(install.enable({ kind: "group", groupId })).resolves.toEqual({
      ok: true,
      value: { installedCount: 2 },
    });
    const recycle = createRecycleService({ ...paths, groups });
    const lifecycle = createLibraryLifecycleService({
      groups,
      libraryRoot: paths.libraryRoot,
      install,
      recycle,
    });

    const result = await lifecycle.recycle({ kind: "group", groupId });

    expect(result.ok).toBe(true);
    await expect(access(join(paths.libraryRoot, "分类A", "coat.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(paths.libraryRoot, "分类A", "sword.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(gameRoot, "coat.npk"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(gameRoot, "sword.npk"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(groups.get(groupId)).resolves.toMatchObject({
      ok: false,
      error: { code: "GROUP_NOT_FOUND", id: groupId },
    });
    expect(
      JSON.parse(await readFile(join(paths.dataRoot, "recycle-bin.json"), "utf8")).items,
    ).toHaveLength(2);
  });

  it("compensates virtual group files and state when recycle fails after all steps", async () => {
    const { paths, gameRoot } = await createLifecycleFixture();
    const sourcePaths = ["分类A\\coat.npk", "分类A\\sword.npk"] as const;
    await Promise.all([
      writeFile(join(paths.libraryRoot, "分类A", "coat.npk"), "coat"),
      writeFile(join(paths.libraryRoot, "分类A", "sword.npk"), "sword"),
      writeFile(join(paths.dataRoot, "group-preview.png"), "preview"),
    ]);
    const groupId = "0552babf-49b5-4390-96a7-1846a0c1e9f8";
    const groups = createVirtualGroupService({
      dataRoot: paths.dataRoot,
      libraryRoot: paths.libraryRoot,
      createId: () => groupId,
    });
    const created = await groups.create({
      categoryRelativePath: "分类A",
      memberRelativePaths: [...sourcePaths],
      name: "套装",
    });
    if (!created.ok) throw new Error("Expected virtual group creation to succeed");
    const previews = createPreviewService({
      assets: createManagedImageAssets({
        assetsRoot: join(paths.dataRoot, "previews"),
        createId: () => "01234567-89ab-4cde-8fab-0123456789ab",
        kind: "preview",
      }),
      store: createPreviewStateStore(join(paths.dataRoot, "previews.json")),
    });
    await previews.set({
      kind: "group",
      groupId,
      sourcePath: join(paths.dataRoot, "group-preview.png"),
    });
    const install = createInstallService({ ...paths, gameRoot, groups });
    await install.enable({ kind: "group", groupId });
    const beforeGroups = await readFile(join(paths.dataRoot, "groups.json"));
    const beforePreviews = await readFile(join(paths.dataRoot, "previews.json"));
    const recycle = createRecycleService({ ...paths, groups, previews });
    const lifecycle = createLibraryLifecycleService({
      groups,
      libraryRoot: paths.libraryRoot,
      install,
      previews,
      recycle,
      executeTransaction: async (steps) =>
        executeFileTransaction([
          ...steps,
          {
            apply: async () => {
              throw new Error("injected group recycle failure");
            },
            compensate: async () => {},
          },
        ]),
    });

    const result = await lifecycle.recycle({ kind: "group", groupId });

    expect(result).toEqual({ ok: false, error: { code: "TRANSACTION_FAILED" } });
    for (const relativePath of sourcePaths) {
      await expect(readFile(join(paths.libraryRoot, relativePath), "utf8")).resolves.toBe(
        relativePath.endsWith("coat.npk") ? "coat" : "sword",
      );
    }
    expect(await readFile(join(gameRoot, "coat.npk"), "utf8")).toBe("coat");
    expect(await readFile(join(gameRoot, "sword.npk"), "utf8")).toBe("sword");
    expect(await readFile(join(paths.dataRoot, "groups.json"))).toEqual(beforeGroups);
    expect(await readFile(join(paths.dataRoot, "previews.json"))).toEqual(beforePreviews);
    await expect(access(join(paths.dataRoot, "recycle-bin.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(groups.get(groupId)).resolves.toMatchObject({ ok: true, value: { id: groupId } });
    await expect(previews.listActive()).resolves.toMatchObject({
      ok: true,
      value: [{ kind: "group", groupId }],
    });
  });
});

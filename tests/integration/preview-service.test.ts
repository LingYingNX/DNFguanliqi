import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createManagedImageAssets } from "../../src/core/assets/managed-image-assets";
import { executeFileTransaction } from "../../src/core/filesystem/file-transaction";
import { createPreviewService } from "../../src/core/previews/preview-service";
import { createPreviewStateStore, readPreviewState } from "../../src/core/previews/preview-state";
import type { InstallationState, PreviewState } from "../../src/core/state/schemas";
import { resolveAppPaths } from "../../src/main/app-paths";
import {
  decorateSnapshotWithInstallation,
  decorateSnapshotWithPreviews,
} from "../../src/main/ipc/decorate-snapshot";
import type { CategorySnapshot } from "../../src/shared/library-dto";

const temporaryDirectories: string[] = [];
const firstId = "01234567-89ab-4cde-8fab-0123456789ab";
const secondId = "11234567-89ab-4cde-8fab-0123456789ab";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function createFixture(): Promise<{
  readonly assetsRoot: string;
  readonly root: string;
  readonly sourceRoot: string;
  readonly stateFile: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "dnf-preview-service-"));
  temporaryDirectories.push(root);
  return {
    assetsRoot: join(root, "previews"),
    root,
    sourceRoot: join(root, "source.png"),
    stateFile: join(root, "previews.json"),
  };
}

function createService(
  fixture: { readonly assetsRoot: string; readonly stateFile: string },
  ids: string[],
) {
  return createPreviewService({
    assets: createManagedImageAssets({
      assetsRoot: fixture.assetsRoot,
      createId: () => ids.shift() ?? firstId,
      kind: "preview",
    }),
    store: createPreviewStateStore(fixture.stateFile),
  });
}

describe("preview service", () => {
  it("marks a virtual group enabled only when every member is enabled", () => {
    const snapshot: CategorySnapshot = {
      relativePath: "Armor",
      patchCount: 3,
      patches: [],
      groups: [
        {
          kind: "group",
          id: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
          name: "Set",
          relativePath: "Armor",
          categoryRelativePath: "Armor",
          previewRelativePath: null,
          previewUrl: null,
          patchCount: 2,
          createdAt: "2026-07-18T00:00:00.000Z",
          enabled: false,
        },
      ],
      childCategories: [],
    };
    const installation: InstallationState = {
      formatVersion: 1,
      records: [
        {
          sourceRelativePath: "Armor\\unrelated.npk",
          sourceHash: "a".repeat(64),
          targetPath: "D:\\DNF\\unrelated.npk",
          targetHash: "a".repeat(64),
          enabledAt: "2026-07-18T00:00:00.000Z",
          transactionId: "155552bf-49b5-4390-96a7-1846a0c1e9f8",
        },
      ],
    };

    const result = decorateSnapshotWithInstallation(
      snapshot,
      installation,
      new Map([["0552babf-49b5-4390-96a7-1846a0c1e9f8", ["Armor\\a.npk", "Armor\\b.npk"]]]),
    );

    expect(result.groups[0]?.enabled).toBe(false);
  });

  it("copies and binds a managed preview to a patch", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.sourceRoot, "preview-one");
    const store = createPreviewStateStore(fixture.stateFile);
    const service = createService(fixture, [firstId]);

    const result = await service.set({
      kind: "patch",
      relativePath: "Armor\\coat.npk",
      sourcePath: fixture.sourceRoot,
    });

    expect(result).toEqual({
      ok: true,
      value: { previewUrl: `dnf-asset://preview/${firstId}.png` },
    });
    expect(await readPreviewState(store)).toEqual({
      ok: true,
      value: {
        formatVersion: 1,
        bindings: [
          {
            state: "active",
            kind: "patch",
            relativePath: "Armor\\coat.npk",
            assetName: `${firstId}.png`,
          },
        ],
      },
    });
    expect(await service.listActive()).toEqual({
      ok: true,
      value: [
        {
          kind: "patch",
          relativePath: "Armor\\coat.npk",
          previewUrl: `dnf-asset://preview/${firstId}.png`,
        },
      ],
    });
  });

  it("commits a replacement before removing the displaced managed asset", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.sourceRoot, "preview-one");
    const service = createService(fixture, [firstId, secondId]);
    await service.set({
      kind: "group",
      groupId: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
      sourcePath: fixture.sourceRoot,
    });
    await writeFile(fixture.sourceRoot, "preview-two");

    const result = await service.set({
      kind: "group",
      groupId: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
      sourcePath: fixture.sourceRoot,
    });

    expect(result).toEqual({
      ok: true,
      value: { previewUrl: `dnf-asset://preview/${secondId}.png` },
    });
    await expect(access(join(fixture.assetsRoot, `${firstId}.png`))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(fixture.assetsRoot, `${secondId}.png`), "utf8")).toBe("preview-two");
  });

  it("removes only the active virtual-group binding for a dissolved group id", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.sourceRoot, "preview-one");
    const service = createService(fixture, [firstId, secondId]);
    await service.set({
      kind: "group",
      groupId: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
      sourcePath: fixture.sourceRoot,
    });
    await service.set({
      kind: "patch",
      relativePath: "Armor\\coat.npk",
      sourcePath: fixture.sourceRoot,
    });

    const plan = await service.prepareRemoveGroupBindingById(
      "0552babf-49b5-4390-96a7-1846a0c1e9f8",
    );
    if (!plan.ok) throw new Error("Expected preview removal plan to succeed");
    await expect(executeFileTransaction(plan.value.steps)).resolves.toEqual({
      ok: true,
      value: undefined,
    });

    expect(await service.listActive()).toEqual({
      ok: true,
      value: [
        {
          kind: "patch",
          relativePath: "Armor\\coat.npk",
          previewUrl: `dnf-asset://preview/${secondId}.png`,
        },
      ],
    });
  });

  it("does not copy a source when preview state is corrupted", async () => {
    const fixture = await createFixture();
    await Promise.all([
      writeFile(fixture.stateFile, "{broken"),
      writeFile(fixture.sourceRoot, "preview"),
    ]);

    const result = await createService(fixture, [firstId]).set({
      kind: "patch",
      relativePath: "coat.npk",
      sourcePath: fixture.sourceRoot,
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "STATE_CORRUPTED", file: fixture.stateFile },
    });
    await expect(readdir(fixture.assetsRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("migrates legacy patch previews beside their matching patches", async () => {
    const fixture = await createFixture();
    const paths = resolveAppPaths({ mode: "development", projectRoot: fixture.root });
    const category = join(paths.libraryRoot, "Armor");
    const service = createService(fixture, [firstId]);
    await Promise.all([
      mkdir(category, { recursive: true }),
      writeFile(fixture.sourceRoot, "legacy preview"),
    ]);
    await writeFile(join(category, "coat.npk"), "patch");
    await service.set({
      kind: "patch",
      relativePath: "Armor\\coat.npk",
      sourcePath: fixture.sourceRoot,
    });

    await expect(service.migratePatchBindingsToLibrary(paths.libraryRoot)).resolves.toEqual({
      ok: true,
      value: { migratedCount: 1 },
    });
    await expect(readFile(join(category, "coat.png"), "utf8")).resolves.toBe("legacy preview");
    await expect(access(join(fixture.assetsRoot, `${firstId}.png`))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(service.listActive()).resolves.toEqual({ ok: true, value: [] });
  });

  it("uses matching library previews only for patches while retaining group bindings", async () => {
    const fixture = await createFixture();
    const assets = createManagedImageAssets({ assetsRoot: fixture.assetsRoot, kind: "preview" });
    const snapshot: CategorySnapshot = {
      relativePath: "",
      patchCount: 2,
      patches: [
        {
          kind: "patch",
          name: "coat.npk",
          relativePath: "coat.npk",
          previewRelativePath: "coat.png",
          previewUrl: null,
          size: 1,
          modifiedAt: "2026-07-18T00:00:00.000Z",
          enabled: false,
        },
        {
          kind: "patch",
          name: "sword.npk",
          relativePath: "sword.npk",
          previewRelativePath: null,
          previewUrl: null,
          size: 1,
          modifiedAt: "2026-07-18T00:00:00.000Z",
          enabled: false,
        },
      ],
      groups: [
        {
          kind: "group",
          id: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
          name: "Set",
          relativePath: "Set",
          previewRelativePath: null,
          previewUrl: null,
          patchCount: 1,
          createdAt: "2026-07-18T00:00:00.000Z",
          enabled: false,
        },
      ],
      childCategories: [],
    };
    const state: PreviewState = {
      formatVersion: 1,
      bindings: [
        { state: "active", kind: "patch", relativePath: "coat.npk", assetName: `${firstId}.png` },
        { state: "active", kind: "patch", relativePath: "sword.npk", assetName: `${firstId}.png` },
        {
          state: "active",
          kind: "group",
          groupId: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
          assetName: `${secondId}.png`,
        },
      ],
    };

    const result = decorateSnapshotWithPreviews(snapshot, state, assets);

    expect(result.ok ? result.value.patches[0]?.previewUrl : result).toBe(
      "dnf-library://library/coat.png",
    );
    expect(result.ok ? result.value.patches[1]?.previewUrl : result).toBeNull();
    expect(result.ok ? result.value.groups[0]?.previewUrl : result).toBe(
      `dnf-asset://preview/${secondId}.png`,
    );
  });
});

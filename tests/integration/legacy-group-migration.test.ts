import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createManagedImageAssets } from "../../src/core/assets/managed-image-assets";
import {
  createVirtualGroupService,
  type VirtualGroupService,
} from "../../src/core/groups/group-service";
import { migrateLegacyGroups } from "../../src/core/groups/legacy-group-migration";
import { createPreviewService } from "../../src/core/previews/preview-service";
import { createPreviewStateStore } from "../../src/core/previews/preview-state";
import { resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];
const GROUP_ID = "0552babf-49b5-4390-96a7-1846a0c1e9f8";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createFixture(): Promise<{
  readonly category: string;
  readonly groupDirectory: string;
  readonly paths: ReturnType<typeof resolveAppPaths>;
  readonly previews: ReturnType<typeof createPreviewService>;
  readonly groups: ReturnType<typeof createVirtualGroupService>;
}> {
  const projectRoot = await mkdtemp(join(tmpdir(), "dnf-legacy-group-migration-"));
  temporaryDirectories.push(projectRoot);
  const paths = resolveAppPaths({ mode: "development", projectRoot });
  const category = join(paths.libraryRoot, "CategoryA");
  const groupDirectory = join(category, "旧组");
  await mkdir(groupDirectory, { recursive: true });
  await Promise.all([
    writeFile(join(groupDirectory, "a.npk"), "a"),
    writeFile(join(groupDirectory, "b.npk"), "b"),
    writeFile(
      join(groupDirectory, ".dnf-group.json"),
      JSON.stringify({
        formatVersion: 1,
        id: GROUP_ID,
        displayName: "旧组",
        createdAt: "2026-08-06T00:00:00.000Z",
      }),
    ),
    writeFile(join(groupDirectory, "旧组.png"), "image"),
  ]);
  const groups = createVirtualGroupService({
    dataRoot: paths.dataRoot,
    libraryRoot: paths.libraryRoot,
  });
  const previews = createPreviewService({
    assets: createManagedImageAssets({
      assetsRoot: join(paths.dataRoot, "previews"),
      createId: () => "d6af2f5d-b60e-447f-ae18-4548c5929aea",
      kind: "preview",
    }),
    store: createPreviewStateStore(join(paths.dataRoot, "previews.json")),
  });
  return { category, groupDirectory, paths, previews, groups };
}

describe("legacy virtual-group migration", () => {
  it("moves members into the category and imports the old group preview", async () => {
    const { category, groupDirectory, groups, paths, previews } = await createFixture();

    await expect(
      migrateLegacyGroups({ groups, libraryRoot: paths.libraryRoot, previews }),
    ).resolves.toEqual({
      ok: true,
      value: { migratedCount: 1 },
    });
    await expect(readFile(join(category, "a.npk"), "utf8")).resolves.toBe("a");
    await expect(readFile(join(category, "b.npk"), "utf8")).resolves.toBe("b");
    await expect(access(groupDirectory)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(groups.list()).resolves.toMatchObject({
      ok: true,
      value: {
        groups: [
          {
            id: GROUP_ID,
            categoryRelativePath: "CategoryA",
            memberRelativePaths: ["CategoryA\\a.npk", "CategoryA\\b.npk"],
          },
        ],
      },
    });
    await expect(previews.listActive()).resolves.toMatchObject({
      ok: true,
      value: [{ kind: "group", groupId: GROUP_ID }],
    });
  });

  it("converts a legacy path-bound preview when the group has no library preview", async () => {
    const { groupDirectory, groups, paths, previews } = await createFixture();
    const legacyAssetName = "01234567-89ab-4cde-8fab-0123456789ab.png";
    await rm(join(groupDirectory, "旧组.png"));
    await mkdir(join(paths.dataRoot, "previews"), { recursive: true });
    await writeFile(join(paths.dataRoot, "previews", legacyAssetName), "legacy");
    await writeFile(
      join(paths.dataRoot, "previews.json"),
      JSON.stringify({
        formatVersion: 1,
        bindings: [
          {
            state: "active",
            kind: "group",
            relativePath: "CategoryA\\旧组",
            assetName: legacyAssetName,
          },
        ],
      }),
    );

    await expect(
      migrateLegacyGroups({ groups, libraryRoot: paths.libraryRoot, previews }),
    ).resolves.toEqual({
      ok: true,
      value: { migratedCount: 1 },
    });
    await expect(previews.listActive()).resolves.toMatchObject({
      ok: true,
      value: [{ kind: "group", groupId: GROUP_ID }],
    });
    const previewState = JSON.parse(
      await readFile(join(paths.dataRoot, "previews.json"), "utf8"),
    ) as { readonly bindings: readonly Record<string, string>[] };
    expect(previewState.bindings).toEqual([
      { state: "active", kind: "group", groupId: GROUP_ID, assetName: legacyAssetName },
    ]);
  });

  it("rolls back moved files when group state cannot be written", async () => {
    const { category, groupDirectory, groups, paths, previews } = await createFixture();
    const failingGroups = {
      ...groups,
      create: async () => ({ ok: false as const, error: { code: "LIBRARY_IO" as const } }),
    } as VirtualGroupService;

    await expect(
      migrateLegacyGroups({
        groups: failingGroups,
        libraryRoot: paths.libraryRoot,
        previews,
      }),
    ).resolves.toEqual({ ok: false, error: { code: "TRANSACTION_FAILED" } });
    await expect(readFile(join(groupDirectory, "a.npk"), "utf8")).resolves.toBe("a");
    await expect(readFile(join(groupDirectory, "b.npk"), "utf8")).resolves.toBe("b");
    await expect(access(join(category, "a.npk"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(groupDirectory)).resolves.toBeUndefined();
    await expect(groups.list()).resolves.toMatchObject({ ok: true, value: { groups: [] } });
  });
});

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createVirtualGroupService } from "../../src/core/groups/group-service";
import { scanCategory, scanGroup } from "../../src/core/library/scanner";
import { resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("real library scanner", () => {
  it("shows virtual groups, hides their members, and scans only live group files", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-virtual-group-scanner-"));
    temporaryDirectories.push(projectRoot);
    const { dataRoot, libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    const category = join(libraryRoot, "分类A");
    await mkdir(category, { recursive: true });
    await Promise.all([
      writeFile(join(category, "a.npk"), "a"),
      writeFile(join(category, "b.npk"), "b"),
      writeFile(join(category, "a.png"), "a preview"),
      writeFile(join(category, "loose.npk"), "loose"),
    ]);
    const groupId = "0552babf-49b5-4390-96a7-1846a0c1e9f8";
    const groups = createVirtualGroupService({
      dataRoot,
      libraryRoot,
      createId: () => groupId,
    });
    const created = await groups.create({
      categoryRelativePath: "分类A",
      memberRelativePaths: ["分类A\\a.npk", "分类A\\b.npk"],
      name: "套装",
    });
    if (!created.ok) throw new Error("Expected virtual group creation to succeed");

    const categorySnapshot = await scanCategory(libraryRoot, "分类A", { groups });
    expect(categorySnapshot).toMatchObject({
      ok: true,
      value: {
        patchCount: 3,
        patches: [{ name: "loose.npk" }],
        groups: [
          {
            id: groupId,
            name: "套装",
            categoryRelativePath: "分类A",
            patchCount: 2,
          },
        ],
      },
    });

    await rm(join(category, "b.npk"), { force: true });
    const groupSnapshot = await scanGroup(libraryRoot, groupId, { groups });
    expect(groupSnapshot).toMatchObject({
      ok: true,
      value: {
        group: { id: groupId, patchCount: 1 },
        patches: [
          {
            name: "a.npk",
            relativePath: "分类A\\a.npk",
            previewRelativePath: "分类A\\a.png",
          },
        ],
      },
    });
  });

  it("keeps child categories out of the parent patch list and recognizes only valid groups", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    const category = join(libraryRoot, "鬼剑士男");
    const child = join(category, "武器");
    const grandchild = join(child, "长剑");
    const group = join(category, "红色套装");
    const invalidGroup = join(category, "普通子目录");
    await Promise.all([
      mkdir(child, { recursive: true }),
      mkdir(grandchild, { recursive: true }),
      mkdir(group, { recursive: true }),
      mkdir(invalidGroup, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(category, "coat.npk"), "coat"),
      writeFile(join(category, "coat.png"), "preview"),
      writeFile(join(category, "notes.txt"), "ignore"),
      writeFile(join(child, "sword.npk"), "child"),
      writeFile(join(grandchild, "long-sword.npk"), "grandchild"),
      writeFile(join(group, "top.npk"), "top"),
      writeFile(join(group, "bottom.NPK"), "bottom"),
      writeFile(
        join(group, ".dnf-group.json"),
        JSON.stringify({
          formatVersion: 1,
          id: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
          displayName: "红色套装",
          createdAt: "2026-07-18T00:00:00.000Z",
        }),
      ),
      writeFile(join(invalidGroup, ".dnf-group.json"), "{broken"),
    ]);

    const result = await scanCategory(libraryRoot, "鬼剑士男");

    expect(result).toMatchObject({
      ok: true,
      value: {
        relativePath: "鬼剑士男",
        patchCount: 3,
        patches: [
          {
            kind: "patch",
            name: "coat.npk",
            relativePath: "鬼剑士男\\coat.npk",
            previewRelativePath: "鬼剑士男\\coat.png",
          },
        ],
        groups: [
          {
            kind: "group",
            name: "红色套装",
            relativePath: "鬼剑士男\\红色套装",
            patchCount: 2,
          },
        ],
        childCategories: [
          {
            name: "普通子目录",
            relativePath: "鬼剑士男\\普通子目录",
            patchCount: 0,
            childCategories: [],
          },
          {
            name: "武器",
            relativePath: "鬼剑士男\\武器",
            patchCount: 1,
            childCategories: [
              {
                name: "长剑",
                relativePath: "鬼剑士男\\武器\\长剑",
                patchCount: 1,
                childCategories: [],
              },
            ],
          },
        ],
      },
    });
  });

  it("counts a virtual group as one item in its category tree", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-virtual-group-count-"));
    temporaryDirectories.push(projectRoot);
    const { dataRoot, libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    const category = join(libraryRoot, "Buff");
    await mkdir(category, { recursive: true });
    await Promise.all([
      writeFile(join(category, "first.npk"), "first"),
      writeFile(join(category, "second.npk"), "second"),
    ]);
    const groups = createVirtualGroupService({
      dataRoot,
      libraryRoot,
      createId: () => "155552bf-49b5-4390-96a7-1846a0c1e9f8",
    });
    const created = await groups.create({
      categoryRelativePath: "Buff",
      memberRelativePaths: ["Buff\\first.npk", "Buff\\second.npk"],
      name: "自定义",
    });
    if (!created.ok) throw new Error("Expected virtual group creation to succeed");

    const result = await scanCategory(libraryRoot, "", { groups });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.childCategories).toEqual([
      {
        name: "Buff",
        relativePath: "Buff",
        patchCount: 1,
        childCategories: [],
      },
    ]);
  });

  it("applies saved child order without hiding new or missing real directories", async () => {
    // Given: three real categories and an order containing one deleted category.
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-order-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    await Promise.all(
      ["Alpha", "Beta", "Gamma"].map((name) => mkdir(join(libraryRoot, name), { recursive: true })),
    );

    // When: the category is scanned with the saved preference.
    await Promise.all([
      mkdir(join(libraryRoot, "Alpha", "First")),
      mkdir(join(libraryRoot, "Alpha", "Second")),
    ]);
    const result = await scanCategory(libraryRoot, "", {
      savedOrders: {
        "": ["Deleted", "Beta", "Alpha"],
        Alpha: ["Alpha\\Second", "Alpha\\First"],
      },
    });

    // Then: saved real categories lead and the new directory remains visible.
    expect(
      result.ok ? result.value.childCategories.map((category) => category.name) : result,
    ).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(
      result.ok
        ? result.value.childCategories
            .find((category) => category.name === "Alpha")
            ?.childCategories.map((category) => category.name)
        : result,
    ).toEqual(["Second", "First"]);
  });

  it("includes descendant patches and groups only when explicitly requested", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-descendants-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    const child = join(libraryRoot, "Armor");
    const grandchild = join(child, "Cloth");
    const group = join(child, "Bundle");
    await Promise.all([mkdir(grandchild, { recursive: true }), mkdir(group, { recursive: true })]);
    await Promise.all([
      writeFile(join(libraryRoot, "shared.npk"), "root"),
      writeFile(join(child, "shared.npk"), "child"),
      writeFile(join(grandchild, "coat.npk"), "grandchild"),
      writeFile(join(group, "grouped.npk"), "grouped"),
      writeFile(join(group, "second-grouped.npk"), "second grouped"),
      writeFile(join(group, "Bundle.jpg"), "group preview"),
      writeFile(
        join(group, ".dnf-group.json"),
        JSON.stringify({
          formatVersion: 1,
          id: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
          displayName: "Bundle",
          createdAt: "2026-07-18T00:00:00.000Z",
        }),
      ),
    ]);

    const direct = await scanCategory(libraryRoot, "");
    const recursive = await scanCategory(libraryRoot, "", { includeDescendants: true });

    expect(direct.ok ? direct.value.patches.map((patch) => patch.relativePath) : direct).toEqual([
      "shared.npk",
    ]);
    expect(direct.ok ? direct.value.patchCount : direct).toBe(1);
    expect(direct.ok ? direct.value.groups : direct).toEqual([]);
    expect(
      recursive.ok ? recursive.value.patches.map((patch) => patch.relativePath) : recursive,
    ).toEqual(["Armor\\Cloth\\coat.npk", "Armor\\shared.npk", "shared.npk"]);
    expect(recursive.ok ? recursive.value.patchCount : recursive).toBe(5);
    expect(recursive.ok ? recursive.value.groups : recursive).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Bundle",
          relativePath: "Armor\\Bundle",
          patchCount: 2,
          previewRelativePath: "Armor\\Bundle\\Bundle.jpg",
        }),
      ]),
    );
  });

  it("exposes matching previews for patches and groups but hides mismatched names", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-matching-preview-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    const category = join(libraryRoot, "Armor");
    const matchingGroup = join(category, "Set");
    const mismatchedGroup = join(category, "Other");
    await Promise.all([
      mkdir(matchingGroup, { recursive: true }),
      mkdir(mismatchedGroup, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(category, "A.npk"), "patch"),
      writeFile(join(category, "A.PNG"), "patch preview"),
      writeFile(join(category, "A-cover.png"), "mismatch"),
      writeFile(
        join(matchingGroup, ".dnf-group.json"),
        JSON.stringify({
          formatVersion: 1,
          id: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
          displayName: "Set",
          createdAt: "2026-07-18T00:00:00.000Z",
        }),
      ),
      writeFile(join(matchingGroup, "set.JPEG"), "group preview"),
      writeFile(
        join(mismatchedGroup, ".dnf-group.json"),
        JSON.stringify({
          formatVersion: 1,
          id: "155552bf-49b5-4390-96a7-1846a0c1e9f8",
          displayName: "Other",
          createdAt: "2026-07-18T00:00:00.000Z",
        }),
      ),
      writeFile(join(mismatchedGroup, "wrong.png"), "mismatch"),
    ]);

    const result = await scanCategory(libraryRoot, "Armor");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.patches[0]?.previewRelativePath).toBe("Armor\\A.PNG");
    expect(result.value.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Set",
          previewRelativePath: "Armor\\Set\\set.JPEG",
        }),
        expect.objectContaining({ name: "Other", previewRelativePath: null }),
      ]),
    );
  });
});

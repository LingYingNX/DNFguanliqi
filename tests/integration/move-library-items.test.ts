import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createVirtualGroupService } from "../../src/core/groups/group-service";
import { moveLibraryItems } from "../../src/core/library/move-library-items";
import { resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];
const groupId = "0552babf-49b5-4390-96a7-1846a0c1e9f8";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

async function createFixture() {
  const projectRoot = await mkdtemp(join(tmpdir(), "dnf-move-items-"));
  temporaryDirectories.push(projectRoot);
  const paths = resolveAppPaths({ mode: "development", projectRoot });
  await Promise.all([
    mkdir(join(paths.libraryRoot, "CategoryA"), { recursive: true }),
    mkdir(join(paths.libraryRoot, "CategoryB"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(paths.libraryRoot, "CategoryA", "a.npk"), "a"),
    writeFile(join(paths.libraryRoot, "CategoryA", "b.npk"), "b"),
  ]);
  const groups = createVirtualGroupService({
    dataRoot: paths.dataRoot,
    libraryRoot: paths.libraryRoot,
    createId: () => groupId,
  });
  const group = await groups.create({
    categoryRelativePath: "CategoryA",
    memberRelativePaths: ["CategoryA\\a.npk", "CategoryA\\b.npk"],
    name: "Bundle",
  });
  if (!group.ok) throw new Error("Expected virtual group creation to succeed");
  return { groups, paths };
}

describe("move library items", () => {
  it("moves every virtual group member and updates the group's category", async () => {
    const { groups, paths } = await createFixture();

    const result = await moveLibraryItems(
      {
        libraryRoot: paths.libraryRoot,
        items: [{ kind: "group", groupId }],
        targetDirectoryRelativePath: "CategoryB",
      },
      { groups },
    );

    expect(result).toEqual({ ok: true, value: { relativePaths: [groupId] } });
    await expect(readFile(join(paths.libraryRoot, "CategoryB", "a.npk"), "utf8")).resolves.toBe(
      "a",
    );
    await expect(readFile(join(paths.libraryRoot, "CategoryB", "b.npk"), "utf8")).resolves.toBe(
      "b",
    );
    await expect(access(join(paths.libraryRoot, "CategoryA", "a.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(groups.get(groupId)).resolves.toMatchObject({
      ok: true,
      value: {
        categoryRelativePath: "CategoryB",
        memberRelativePaths: ["CategoryB\\a.npk", "CategoryB\\b.npk"],
      },
    });
  });

  it("leaves NPK files and virtual state unchanged when a group target conflicts", async () => {
    const { groups, paths } = await createFixture();
    await writeFile(join(paths.libraryRoot, "CategoryB", "b.npk"), "occupied");

    const result = await moveLibraryItems(
      {
        libraryRoot: paths.libraryRoot,
        items: [{ kind: "group", groupId }],
        targetDirectoryRelativePath: "CategoryB",
      },
      { groups },
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "TARGET_CONFLICT", relativePath: "CategoryB\\b.npk" },
    });
    await expect(readFile(join(paths.libraryRoot, "CategoryA", "a.npk"), "utf8")).resolves.toBe(
      "a",
    );
    await expect(readFile(join(paths.libraryRoot, "CategoryA", "b.npk"), "utf8")).resolves.toBe(
      "b",
    );
    await expect(groups.get(groupId)).resolves.toMatchObject({
      ok: true,
      value: {
        categoryRelativePath: "CategoryA",
        memberRelativePaths: ["CategoryA\\a.npk", "CategoryA\\b.npk"],
      },
    });
  });
});

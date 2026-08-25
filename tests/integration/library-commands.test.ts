import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createVirtualGroupService } from "../../src/core/groups/group-service";
import { createLibraryCommands } from "../../src/core/library/library-commands";
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
  const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-commands-"));
  temporaryDirectories.push(projectRoot);
  const paths = resolveAppPaths({ mode: "development", projectRoot });
  const category = join(paths.libraryRoot, "CategoryA");
  await mkdir(category, { recursive: true });
  await Promise.all([
    writeFile(join(category, "a.npk"), "a"),
    writeFile(join(category, "b.npk"), "b"),
  ]);
  const groups = createVirtualGroupService({
    dataRoot: paths.dataRoot,
    libraryRoot: paths.libraryRoot,
    createId: () => groupId,
    now: () => new Date("2026-08-06T00:00:00.000Z"),
  });
  return { category, groups, paths };
}

describe("library commands", () => {
  it("creates and dissolves a virtual group without moving its NPK files", async () => {
    const { category, groups, paths } = await createFixture();
    const commands = createLibraryCommands({ groups });

    const created = await commands.createGroup({
      libraryRoot: paths.libraryRoot,
      categoryRelativePath: "CategoryA",
      patchRelativePaths: ["CategoryA\\a.npk", "CategoryA\\b.npk"],
      groupName: "Bundle",
    });

    expect(created).toEqual({
      ok: true,
      value: { id: groupId, categoryRelativePath: "CategoryA" },
    });
    await expect(readFile(join(category, "a.npk"), "utf8")).resolves.toBe("a");
    await expect(readFile(join(category, "b.npk"), "utf8")).resolves.toBe("b");
    await expect(access(join(category, "Bundle"))).rejects.toMatchObject({ code: "ENOENT" });

    const dissolved = await commands.dissolveGroup({ groupId });

    expect(dissolved).toEqual({ ok: true, value: { id: groupId } });
    await expect(groups.list()).resolves.toEqual({
      ok: true,
      value: { formatVersion: 1, groups: [] },
    });
    await expect(readFile(join(category, "a.npk"), "utf8")).resolves.toBe("a");
    await expect(readFile(join(category, "b.npk"), "utf8")).resolves.toBe("b");
  });
});

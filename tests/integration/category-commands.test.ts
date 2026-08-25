import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCategoryCommands } from "../../src/core/library/category-commands";
import { resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "dnf-category-commands-"));
  temporaryDirectories.push(root);
  const paths = resolveAppPaths({ mode: "development", projectRoot: root });
  await mkdir(join(paths.libraryRoot, "Armor"), { recursive: true });
  return { commands: createCategoryCommands(paths.libraryRoot), paths };
}

describe("category commands", () => {
  it("creates a child category and renames it", async () => {
    const { commands, paths } = await createFixture();

    const created = await commands.create({ parentRelativePath: "Armor", name: "Cloth" });
    const renamed = await commands.rename({ relativePath: "Armor\\Cloth", name: "Fabric" });

    expect(created).toEqual({ ok: true, value: { relativePath: "Armor\\Cloth" } });
    expect(renamed).toEqual({ ok: true, value: { relativePath: "Armor\\Fabric" } });
    await expect(access(join(paths.libraryRoot, "Armor", "Fabric"))).resolves.toBeUndefined();
    await expect(access(join(paths.libraryRoot, "Armor", "Cloth"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("moves a category with nested children into another category", async () => {
    const { commands, paths } = await createFixture();
    const source = join(paths.libraryRoot, "Female", "Male");
    await mkdir(join(source, "Nested"), { recursive: true });
    await writeFile(join(source, "male.npk"), "male");
    await writeFile(join(source, "Nested", "nested.npk"), "nested");
    await mkdir(join(paths.libraryRoot, "Interface"));

    const result = await (
      commands as unknown as {
        move(request: {
          readonly sourceRelativePath: string;
          readonly targetParentRelativePath: string;
        }): Promise<unknown>;
      }
    ).move({ sourceRelativePath: "Female\\Male", targetParentRelativePath: "Interface" });

    expect(result).toEqual({ ok: true, value: { relativePath: "Interface\\Male" } });
    await expect(
      access(join(paths.libraryRoot, "Interface", "Male", "male.npk")),
    ).resolves.toBeUndefined();
    await expect(
      access(join(paths.libraryRoot, "Interface", "Male", "Nested", "nested.npk")),
    ).resolves.toBeUndefined();
    await expect(access(source)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects moving a category into itself or its descendant", async () => {
    const { commands, paths } = await createFixture();
    const source = join(paths.libraryRoot, "Female", "Male");
    await mkdir(join(source, "Nested"), { recursive: true });
    const move = (
      commands as unknown as {
        move(request: {
          readonly sourceRelativePath: string;
          readonly targetParentRelativePath: string;
        }): Promise<unknown>;
      }
    ).move;

    const result = await move({
      sourceRelativePath: "Female\\Male",
      targetParentRelativePath: "Female\\Male\\Nested",
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_CATEGORY_PATH", relativePath: "Female\\Male" },
    });
    await expect(access(source)).resolves.toBeUndefined();
    await expect(
      access(join(paths.libraryRoot, "Female", "Male", "Nested")),
    ).resolves.toBeUndefined();
  });

  it("does not overwrite a same-name category at the target", async () => {
    const { commands, paths } = await createFixture();
    await mkdir(join(paths.libraryRoot, "Female", "Male"), { recursive: true });
    await mkdir(join(paths.libraryRoot, "Interface", "Male"), { recursive: true });

    const result = await (
      commands as unknown as {
        move(request: {
          readonly sourceRelativePath: string;
          readonly targetParentRelativePath: string;
        }): Promise<unknown>;
      }
    ).move({ sourceRelativePath: "Female\\Male", targetParentRelativePath: "Interface" });

    expect(result).toEqual({
      ok: false,
      error: { code: "TARGET_CONFLICT", relativePath: "Interface\\Male" },
    });
    await expect(access(join(paths.libraryRoot, "Female", "Male"))).resolves.toBeUndefined();
  });

  it("deletes only an empty category", async () => {
    const { commands, paths } = await createFixture();
    await mkdir(join(paths.libraryRoot, "Armor", "Empty"));

    const result = await commands.remove({ relativePath: "Armor\\Empty" });

    expect(result).toEqual({ ok: true, value: { relativePath: "Armor\\Empty" } });
    await expect(access(join(paths.libraryRoot, "Armor", "Empty"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("preserves a non-empty category when deletion is rejected", async () => {
    const { commands, paths } = await createFixture();
    const category = join(paths.libraryRoot, "Armor", "Used");
    await mkdir(category);
    await writeFile(join(category, "coat.npk"), "coat");

    const result = await commands.remove({ relativePath: "Armor\\Used" });

    expect(result).toEqual({
      ok: false,
      error: { code: "CATEGORY_NOT_EMPTY", relativePath: "Armor\\Used" },
    });
    expect(await readFile(join(category, "coat.npk"), "utf8")).toBe("coat");
  });

  it("does not rename when the destination category exists", async () => {
    const { commands, paths } = await createFixture();
    await Promise.all([
      mkdir(join(paths.libraryRoot, "Armor", "Cloth")),
      mkdir(join(paths.libraryRoot, "Armor", "Fabric")),
    ]);

    const result = await commands.rename({ relativePath: "Armor\\Cloth", name: "Fabric" });

    expect(result).toEqual({
      ok: false,
      error: { code: "TARGET_CONFLICT", relativePath: "Armor\\Fabric" },
    });
    await expect(access(join(paths.libraryRoot, "Armor", "Cloth"))).resolves.toBeUndefined();
    await expect(access(join(paths.libraryRoot, "Armor", "Fabric"))).resolves.toBeUndefined();
  });

  it("does not treat a patch file as a category", async () => {
    const { commands, paths } = await createFixture();
    await writeFile(join(paths.libraryRoot, "coat.npk"), "coat");

    const result = await commands.remove({ relativePath: "coat.npk" });

    expect(result).toEqual({
      ok: false,
      error: { code: "CATEGORY_TYPE_MISMATCH", relativePath: "coat.npk" },
    });
    expect(await readFile(join(paths.libraryRoot, "coat.npk"), "utf8")).toBe("coat");
  });

  it("does not create a category inside a patch group", async () => {
    const { commands, paths } = await createFixture();
    const group = join(paths.libraryRoot, "Group");
    await mkdir(group);
    await writeFile(
      join(group, ".dnf-group.json"),
      JSON.stringify({
        formatVersion: 1,
        id: "0552babf-49b5-4390-96a7-1846a0c1e9f8",
        displayName: "Group",
        createdAt: "2026-07-18T00:00:00.000Z",
      }),
    );

    const result = await commands.create({ parentRelativePath: "Group", name: "Child" });

    expect(result).toEqual({
      ok: false,
      error: { code: "CATEGORY_TYPE_MISMATCH", relativePath: "Group" },
    });
    await expect(access(join(group, "Child"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

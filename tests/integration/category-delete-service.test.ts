import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCategoryDeleteService } from "../../src/core/application/category-delete-service";
import { createRecycleService } from "../../src/core/recycle/recycle-service";
import { resolveAppPaths } from "../../src/main/app-paths";
import { err } from "../../src/shared/result";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function createFixture(): Promise<ReturnType<typeof resolveAppPaths>> {
  const root = await mkdtemp(join(tmpdir(), "dnf-category-delete-"));
  temporaryDirectories.push(root);
  const paths = resolveAppPaths({ mode: "development", projectRoot: root });
  await mkdir(paths.libraryRoot, { recursive: true });
  return paths;
}

describe("category delete service", () => {
  it("recycles nested patches and removes only the category directory", async () => {
    const paths = await createFixture();
    const category = join(paths.libraryRoot, "Armor");
    await mkdir(join(category, "Nested"), { recursive: true });
    await writeFile(join(category, "coat.npk"), "coat");
    await writeFile(join(category, "Nested", "sword.npk"), "sword");
    const recycle = createRecycleService({ ...paths });
    const service = createCategoryDeleteService({
      libraryRoot: paths.libraryRoot,
      recycleMany: (items) => recycle.recycleMany(items),
    });

    const result = await service.remove({ confirmed: true, relativePath: "Armor" });

    expect(result).toEqual({ ok: true, value: { relativePath: "Armor" } });
    await expect(access(category)).rejects.toMatchObject({ code: "ENOENT" });
    const manifest = JSON.parse(await readFile(join(paths.dataRoot, "recycle-bin.json"), "utf8"));
    expect(
      manifest.items.map((item: { originalRelativePath: string }) => item.originalRelativePath),
    ).toEqual(["Armor\\coat.npk", "Armor\\Nested\\sword.npk"]);
  });

  it("removes an empty category without creating a recycle entry", async () => {
    const paths = await createFixture();
    const category = join(paths.libraryRoot, "Empty");
    await mkdir(category);
    const recycle = createRecycleService({ ...paths });
    const service = createCategoryDeleteService({
      libraryRoot: paths.libraryRoot,
      recycleMany: (items) => recycle.recycleMany(items),
    });

    const result = await service.remove({ confirmed: true, relativePath: "Empty" });

    expect(result).toEqual({ ok: true, value: { relativePath: "Empty" } });
    await expect(access(category)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(paths.dataRoot, "recycle-bin.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("leaves the category untouched when recycling fails", async () => {
    const paths = await createFixture();
    const category = join(paths.libraryRoot, "Armor");
    await mkdir(category);
    await writeFile(join(category, "coat.npk"), "coat");
    const service = createCategoryDeleteService({
      libraryRoot: paths.libraryRoot,
      recycleMany: async () => err({ code: "RECYCLE_IO" }),
    });

    const result = await service.remove({ confirmed: true, relativePath: "Armor" });

    expect(result).toEqual({ ok: false, error: { code: "RECYCLE_IO" } });
    await expect(access(join(category, "coat.npk"))).resolves.toBeUndefined();
    await expect(access(category)).resolves.toBeUndefined();
  });
});

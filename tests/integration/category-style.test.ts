import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCategoryStyleService } from "../../src/core/library/category-style-service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("category style state", () => {
  it("persists styles and relocates descendants", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dnf-category-style-"));
    temporaryDirectories.push(directory);
    const service = createCategoryStyleService(join(directory, "category-styles.json"));

    await service.set("Armor", "star");
    await service.set("Armor\\Plate", "add");
    await service.relocate("Armor", "Equipment");

    await expect(service.getAll()).resolves.toEqual({
      ok: true,
      value: {
        styles: { Equipment: "star", "Equipment\\Plate": "add" },
        colors: {},
        styleColors: {},
      },
    });
    expect(
      JSON.parse(await readFile(join(directory, "category-styles.json"), "utf8")),
    ).toMatchObject({
      formatVersion: 1,
    });
  });

  it("removes a category style subtree", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dnf-category-style-"));
    temporaryDirectories.push(directory);
    const service = createCategoryStyleService(join(directory, "category-styles.json"));

    await service.set("Armor", "star");
    await service.set("Armor\\Plate", "add");
    await service.set("Weapons", "outline");
    await service.remove("Armor");

    await expect(service.getAll()).resolves.toEqual({
      ok: true,
      value: { styles: { Weapons: "outline" }, colors: {}, styleColors: {} },
    });
  });
});

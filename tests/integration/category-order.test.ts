import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCategoryOrderService } from "../../src/core/library/category-order-service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("category order state", () => {
  it("persists independent child orders for each parent", async () => {
    // Given: an empty real state file location.
    const directory = await mkdtemp(join(tmpdir(), "dnf-category-order-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "category-order.json");
    const service = createCategoryOrderService(file);

    // When: two parent-scoped orders are written.
    await service.set("", ["Armor", "Weapons"]);
    const written = await service.set("Armor", ["Armor\\Plate", "Armor\\Cloth"]);

    // Then: both orders round-trip through the atomic JSON file.
    expect(written).toEqual({ ok: true, value: undefined });
    expect(await service.get("")).toEqual({ ok: true, value: ["Armor", "Weapons"] });
    expect(await service.get("Armor")).toEqual({
      ok: true,
      value: ["Armor\\Plate", "Armor\\Cloth"],
    });
    expect(JSON.parse(await readFile(file, "utf8"))).toMatchObject({ formatVersion: 1 });
  });

  it("relocates nested order keys when a category moves", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dnf-category-order-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "category-order.json");
    const service = createCategoryOrderService(file);
    await service.set("", ["Female", "Interface"]);
    await service.set("Female", ["Female\\Male"]);
    await service.set("Female\\Male", ["Female\\Male\\Nested"]);
    await service.set("Interface", ["Interface\\Existing"]);

    const result = await service.move({
      sourceRelativePath: "Female\\Male",
      targetRelativePath: "Interface\\Male",
      sourceParentRelativePath: "Female",
      sourceParentChildRelativePaths: [],
      targetParentRelativePath: "Interface",
      targetParentChildRelativePaths: ["Interface\\Male", "Interface\\Existing"],
    });

    expect(result).toEqual({ ok: true, value: undefined });
    await expect(service.getAll()).resolves.toEqual({
      ok: true,
      value: {
        "": ["Female", "Interface"],
        Female: [],
        "Interface\\Male": ["Interface\\Male\\Nested"],
        Interface: ["Interface\\Male", "Interface\\Existing"],
      },
    });
  });

  it("keeps the saved position when a category is renamed", async () => {
    // Given: a parent whose children carry an explicit non-alphabetical order.
    const directory = await mkdtemp(join(tmpdir(), "dnf-category-order-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "category-order.json");
    const service = createCategoryOrderService(file);
    await service.set("", ["Zeta", "Alpha"]);
    await service.set("Zeta", ["Zeta\\Second", "Zeta\\First"]);

    // When: the middle child is renamed.
    const result = await service.relocate("Zeta", "Renamed");

    // Then: the renamed entry keeps its slot and its own child order follows the new path.
    expect(result).toEqual({ ok: true, value: undefined });
    await expect(service.get("")).resolves.toEqual({ ok: true, value: ["Renamed", "Alpha"] });
    await expect(service.get("Renamed")).resolves.toEqual({
      ok: true,
      value: ["Renamed\\Second", "Renamed\\First"],
    });
  });

  it("relocates descendant order keys when a renamed category has children", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dnf-category-order-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "category-order.json");
    const service = createCategoryOrderService(file);
    await service.set("", ["Female"]);
    await service.set("Female", ["Female\\Male", "Female\\Other"]);
    await service.set("Female\\Male", ["Female\\Male\\Nested"]);
    await service.set("Interface", ["Interface\\Existing"]);

    const result = await service.relocate("Female", "Renamed");

    expect(result).toEqual({ ok: true, value: undefined });
    // 被改名分类自身及其后代的顺序表全部迁到新路径，无关父级保持不变。
    await expect(service.getAll()).resolves.toEqual({
      ok: true,
      value: {
        "": ["Renamed"],
        Renamed: ["Renamed\\Male", "Renamed\\Other"],
        "Renamed\\Male": ["Renamed\\Male\\Nested"],
        Interface: ["Interface\\Existing"],
      },
    });
  });

  it("reports corrupted state instead of resetting the order", async () => {
    // Given: a corrupted persisted category order.
    const directory = await mkdtemp(join(tmpdir(), "dnf-category-order-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "category-order.json");
    await writeFile(file, "{broken", "utf8");

    // When: the service reads the parent order.
    const result = await createCategoryOrderService(file).get("");

    // Then: corruption remains a visible typed state error.
    expect(result).toEqual({ ok: false, error: { code: "STATE_CORRUPTED", file } });
  });

  it.each([
    { "": ["Armor", "Armor"] },
    { Armor: ["Weapons\\Sword"] },
    { Armor: ["Armor\\Cloth", "Armor/Cloth"] },
    { "": ["Armor", "armor"] },
  ])("rejects semantically invalid persisted order %j", async (orders) => {
    // Given: syntactically valid JSON that violates category-order semantics.
    const directory = await mkdtemp(join(tmpdir(), "dnf-category-order-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "category-order.json");
    await writeFile(file, JSON.stringify({ formatVersion: 1, orders }), "utf8");

    // When: the persisted state crosses the atomic store boundary.
    const result = await createCategoryOrderService(file).get("");

    // Then: duplicate and cross-parent entries are typed as corrupted state.
    expect(result).toEqual({ ok: false, error: { code: "STATE_CORRUPTED", file } });
  });
});

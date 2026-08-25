import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createInstallService } from "../../src/core/install/install-service";
import { createPresetService } from "../../src/core/presets/preset-service";
import { createPresetStateStore } from "../../src/core/presets/preset-state";
import { parseGameRoot, resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function createFixture(): Promise<{
  readonly gameRoot: string;
  readonly install: ReturnType<typeof createInstallService>;
  readonly paths: ReturnType<typeof resolveAppPaths>;
  readonly service: ReturnType<typeof createPresetService>;
}> {
  const root = await mkdtemp(join(tmpdir(), "dnf-presets-"));
  temporaryDirectories.push(root);
  const paths = resolveAppPaths({ mode: "development", projectRoot: root });
  const gameRoot = join(root, "game");
  await Promise.all([
    mkdir(join(paths.libraryRoot, "Armor"), { recursive: true }),
    mkdir(gameRoot, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(paths.libraryRoot, "coat.npk"), "coat"),
    writeFile(join(paths.libraryRoot, "Armor", "hood.npk"), "hood"),
    writeFile(join(paths.libraryRoot, "unrelated.npk"), "unrelated"),
  ]);
  const install = createInstallService({
    ...paths,
    gameRoot: parseGameRoot(gameRoot),
  });
  return {
    gameRoot,
    install,
    paths,
    service: createPresetService({
      install,
      libraryRoot: paths.libraryRoot,
      store: createPresetStateStore(join(paths.dataRoot, "presets.json")),
    }),
  };
}

describe("preset service", () => {
  it("creates and lists references without copying NPK files", async () => {
    const { paths, service } = await createFixture();

    const created = await service.create({
      name: "战斗预设",
      items: [
        { kind: "patch", relativePath: "coat.npk" },
        { kind: "patch", relativePath: "Armor/hood.npk" },
      ],
    });

    expect(created.ok).toBe(true);
    expect(created.ok ? created.value.items : []).toEqual([
      { kind: "patch", relativePath: "coat.npk" },
      { kind: "patch", relativePath: "Armor\\hood.npk" },
    ]);
    expect(created.ok ? created.value.missingPaths : []).toEqual([]);
    expect(JSON.parse(await readFile(join(paths.dataRoot, "presets.json"), "utf8"))).toMatchObject({
      formatVersion: 1,
      presets: [{ name: "战斗预设" }],
    });
  });

  it("deduplicates references and rejects invalid or missing items", async () => {
    const { service } = await createFixture();

    const created = await service.create({
      name: "重复预设",
      items: [
        { kind: "patch", relativePath: "coat.npk" },
        { kind: "patch", relativePath: "COAT.NPK" },
      ],
    });
    expect(created.ok).toBe(true);
    expect(created.ok ? created.value.items : []).toHaveLength(1);

    const missing = await service.create({
      name: "缺失预设",
      items: [{ kind: "patch", relativePath: "missing.npk" }],
    });
    expect(missing).toEqual({
      ok: false,
      error: { code: "PRESET_ITEM_MISSING", relativePath: "missing.npk" },
    });
  });

  it("renames and deletes only the manifest", async () => {
    const { paths, service } = await createFixture();
    const created = await service.create({
      name: "临时预设",
      items: [{ kind: "patch", relativePath: "coat.npk" }],
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const renamed = await service.rename({ id: created.value.id, name: "正式预设" });
    expect(renamed.ok ? renamed.value.name : null).toBe("正式预设");
    expect(await readFile(join(paths.libraryRoot, "coat.npk"), "utf8")).toBe("coat");

    expect(await service.remove({ id: created.value.id })).toEqual({
      ok: true,
      value: { id: created.value.id },
    });
    await expect(access(join(paths.libraryRoot, "coat.npk"))).resolves.toBeUndefined();
  });

  it("installs existing references additively and reports missing paths", async () => {
    const { gameRoot, install, paths, service } = await createFixture();
    const createdPreset = await service.create({
      name: "叠加预设",
      items: [
        { kind: "patch", relativePath: "coat.npk" },
        { kind: "patch", relativePath: "Armor/hood.npk" },
      ],
    });
    expect(createdPreset.ok).toBe(true);
    if (!createdPreset.ok) return;

    await rm(join(paths.libraryRoot, "Armor", "hood.npk"), { force: true });
    const unrelated = await install.enable({
      kind: "patch",
      relativePath: "unrelated.npk",
    });
    expect(unrelated.ok).toBe(true);

    const result = await service.install(createdPreset.value.id);

    expect(result).toEqual({
      ok: true,
      value: { installedCount: 1, missingPaths: ["Armor\\hood.npk"] },
    });
    await expect(access(join(gameRoot, "coat.npk"))).resolves.toBeUndefined();
    await expect(access(join(gameRoot, "unrelated.npk"))).resolves.toBeUndefined();
  });
});

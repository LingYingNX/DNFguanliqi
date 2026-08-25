import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createManagedImageAssets } from "../../src/core/assets/managed-image-assets";
import { createWallpaperService } from "../../src/core/wallpapers/wallpaper-service";
import {
  createWallpaperStateStore,
  readWallpaperState,
} from "../../src/core/wallpapers/wallpaper-state";

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
  readonly source: string;
  readonly stateFile: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "dnf-wallpaper-service-"));
  temporaryDirectories.push(root);
  await mkdir(join(root, "wallpapers"));
  return {
    assetsRoot: join(root, "wallpapers"),
    source: join(root, "source.png"),
    stateFile: join(root, "wallpapers.json"),
  };
}

function createService(
  fixture: { readonly assetsRoot: string; readonly stateFile: string },
  ids: string[],
) {
  return createWallpaperService({
    assets: createManagedImageAssets({
      assetsRoot: fixture.assetsRoot,
      createId: () => ids.shift() ?? firstId,
      kind: "wallpaper",
    }),
    store: createWallpaperStateStore(fixture.stateFile),
  });
}

describe("wallpaper service", () => {
  it("imports into a slot while preserving the source and inactive state", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.source, "wallpaper-one");
    const service = createService(fixture, [firstId]);

    const result = await service.import({ slot: 2, sourcePath: fixture.source });

    expect(result).toEqual({
      ok: true,
      value: {
        slot: 2,
        assetName: `${firstId}.png`,
        wallpaperUrl: `dnf-asset://wallpaper/${firstId}.png`,
      },
    });
    expect(await readFile(fixture.source, "utf8")).toBe("wallpaper-one");
    expect(await readWallpaperState(createWallpaperStateStore(fixture.stateFile))).toMatchObject({
      ok: true,
      value: { slots: [null, null, `${firstId}.png`, null, null], activeSlot: null },
    });
  });

  it("imports and activates a slot in one state update", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.source, "wallpaper-one");
    const service = createService(fixture, [firstId]);

    const result = await service.importAndActivate({ slot: 2, sourcePath: fixture.source });

    expect(result.ok).toBe(true);
    expect(await readWallpaperState(createWallpaperStateStore(fixture.stateFile))).toMatchObject({
      ok: true,
      value: { slots: [null, null, `${firstId}.png`, null, null], activeSlot: 2 },
    });
  });

  it("replaces a slot and removes only the displaced managed asset", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.source, "wallpaper-one");
    const service = createService(fixture, [firstId, secondId]);
    await service.import({ slot: 0, sourcePath: fixture.source });
    await writeFile(fixture.source, "wallpaper-two");

    const result = await service.import({ slot: 0, sourcePath: fixture.source });

    expect(result.ok ? result.value.assetName : result).toBe(`${secondId}.png`);
    await expect(access(join(fixture.assetsRoot, `${firstId}.png`))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(fixture.source, "utf8")).toBe("wallpaper-two");
  });

  it("activates a populated slot and rejects an empty slot", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.source, "wallpaper");
    const service = createService(fixture, [firstId]);
    await service.import({ slot: 1, sourcePath: fixture.source });

    expect(await service.activate(1)).toEqual({ ok: true, value: { activeSlot: 1 } });
    expect(await service.activate(4)).toEqual({
      ok: false,
      error: { code: "WALLPAPER_EMPTY" },
    });
  });

  it("deletes a slot and clears it when active", async () => {
    const fixture = await createFixture();
    await writeFile(fixture.source, "wallpaper");
    const service = createService(fixture, [firstId]);
    await service.import({ slot: 3, sourcePath: fixture.source });
    await service.activate(3);

    const result = await service.delete(3);

    expect(result).toEqual({ ok: true, value: { slot: 3 } });
    await expect(access(join(fixture.assetsRoot, `${firstId}.png`))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readWallpaperState(createWallpaperStateStore(fixture.stateFile))).toMatchObject({
      ok: true,
      value: { slots: [null, null, null, null, null], activeSlot: null },
    });
  });
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAppSettingsStore,
  readAppSettings,
  withGameDirectory,
} from "../../src/core/appearance/appearance-settings";
import { createPreviewStateStore, readPreviewState } from "../../src/core/previews/preview-state";
import {
  AppearanceSettingsSchema,
  defaultAppearanceSettings,
  PreviewStateSchema,
  WallpaperStateSchema,
} from "../../src/core/state/schemas";
import {
  createWallpaperStateStore,
  readWallpaperState,
} from "../../src/core/wallpapers/wallpaper-state";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function createFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "dnf-appearance-state-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("appearance state", () => {
  it("loads documented defaults and migrates game-directory-only settings", async () => {
    const directory = await createFixture();
    const file = join(directory, "settings.json");
    await writeFile(file, JSON.stringify({ formatVersion: 1, gameDirectory: "D:\\DNF" }));

    const result = await readAppSettings(createAppSettingsStore(file));

    expect(result).toEqual({
      ok: true,
      value: {
        formatVersion: 1,
        gameDirectory: "D:\\DNF",
        appearance: defaultAppearanceSettings(),
      },
    });
    expect(defaultAppearanceSettings().opacity).toBe(50);
  });

  it("keeps legacy settings readable when font fields are absent", async () => {
    const directory = await createFixture();
    const file = join(directory, "settings.json");
    await writeFile(
      file,
      JSON.stringify({
        formatVersion: 1,
        gameDirectory: null,
        appearance: {
          theme: "halo",
          temperature: 0,
          saturation: 100,
          contrast: 100,
          scale: 100,
          opacity: 50,
          blur: 0,
          positionX: 50,
          positionY: 50,
          categoryTextColor: "#9AA0AE",
          selectedTint: "#5B6BFF",
        },
      }),
    );

    const result = await readAppSettings(createAppSettingsStore(file));

    expect(result).toEqual({
      ok: true,
      value: {
        formatVersion: 1,
        gameDirectory: null,
        appearance: defaultAppearanceSettings(),
      },
    });
  });

  it("migrates the legacy shared font settings to both font targets", async () => {
    const directory = await createFixture();
    const file = join(directory, "settings.json");
    const defaults = defaultAppearanceSettings();
    const {
      navigationFontColor: _navigationFontColor,
      patchCardFontColor: _patchCardFontColor,
      ...legacyDefaults
    } = defaults;
    await writeFile(
      file,
      JSON.stringify({
        formatVersion: 1,
        gameDirectory: null,
        appearance: {
          ...legacyDefaults,
          fontFamily: "Microsoft YaHei",
          fontColor: "#12AB34",
        },
      }),
    );

    const result = await readAppSettings(createAppSettingsStore(file));

    expect(result).toEqual({
      ok: true,
      value: {
        formatVersion: 1,
        gameDirectory: null,
        appearance: {
          ...defaultAppearanceSettings(),
          navigationFontColor: "#12AB34",
          patchCardFontColor: "#12AB34",
        },
      },
    });
  });

  it.each([
    ["temperature", -101],
    ["temperature", 101],
    ["saturation", -1],
    ["saturation", 201],
    ["contrast", -1],
    ["contrast", 201],
    ["scale", 49],
    ["scale", 201],
    ["opacity", -1],
    ["opacity", 101],
    ["blur", -1],
    ["blur", 41],
    ["positionX", -1],
    ["positionX", 101],
    ["positionY", -1],
    ["positionY", 101],
  ])("rejects %s outside its required range", (field, value) => {
    expect(
      AppearanceSettingsSchema.safeParse({ ...defaultAppearanceSettings(), [field]: value })
        .success,
    ).toBe(false);
  });

  it("accepts separate navigation and patch-card fonts and colors", () => {
    expect(
      AppearanceSettingsSchema.safeParse({
        ...defaultAppearanceSettings(),
        theme: "glass",
        categoryTextColor: "#A0B1C2",
        selectedTint: "#102030",
        navigationFontColor: "#12AB34",
        patchCardFontColor: "#34AB12",
      }).success,
    ).toBe(true);
    expect(
      AppearanceSettingsSchema.safeParse({
        ...defaultAppearanceSettings(),
        theme: "high-contrast",
        categoryTextColor: "#A0B1C2",
        selectedTint: "#102030",
        navigationFontColor: "#12AB34",
        patchCardFontColor: "#34AB12",
      }).success,
    ).toBe(true);
    expect(
      AppearanceSettingsSchema.safeParse({
        ...defaultAppearanceSettings(),
        categoryTextColor: "red",
      }).success,
    ).toBe(false);
    expect(
      AppearanceSettingsSchema.safeParse({
        ...defaultAppearanceSettings(),
        patchCardFontColor: "red",
      }).success,
    ).toBe(false);
  });

  it("round-trips the glass theme through the app settings store", async () => {
    const directory = await createFixture();
    const store = createAppSettingsStore(join(directory, "settings.json"));
    const settings = {
      formatVersion: 1 as const,
      gameDirectory: null,
      appearance: { ...defaultAppearanceSettings(), theme: "glass" as const },
    };

    expect(await store.write(settings)).toEqual({ ok: true, value: undefined });
    expect(await readAppSettings(store)).toEqual({ ok: true, value: settings });
  });

  it("preserves appearance values when the game directory changes", () => {
    const settings = {
      formatVersion: 1 as const,
      gameDirectory: null,
      appearance: { ...defaultAppearanceSettings(), opacity: 72 },
    };

    expect(withGameDirectory(settings, "D:\\DNF")).toEqual({
      ...settings,
      gameDirectory: "D:\\DNF",
    });
  });
});

describe("preview and wallpaper state", () => {
  it("uses empty defaults for missing preview and wallpaper files", async () => {
    const directory = await createFixture();

    const [previews, wallpapers] = await Promise.all([
      readPreviewState(createPreviewStateStore(join(directory, "previews.json"))),
      readWallpaperState(createWallpaperStateStore(join(directory, "wallpapers.json"))),
    ]);

    expect(previews).toEqual({ ok: true, value: { formatVersion: 1, bindings: [] } });
    expect(wallpapers).toEqual({
      ok: true,
      value: { formatVersion: 1, slots: [null, null, null, null, null], activeSlot: null },
    });
  });

  it("rejects duplicate preview identities and activation of an empty wallpaper slot", () => {
    expect(
      PreviewStateSchema.safeParse({
        formatVersion: 1,
        bindings: [
          { state: "active", kind: "patch", relativePath: "a.npk", assetName: "one.png" },
          { state: "active", kind: "patch", relativePath: "a.npk", assetName: "two.png" },
        ],
      }).success,
    ).toBe(false);
    expect(
      WallpaperStateSchema.safeParse({
        formatVersion: 1,
        slots: [null, null, null, null, null],
        activeSlot: 2,
      }).success,
    ).toBe(false);
  });

  it("preserves corrupted files as typed state errors", async () => {
    const directory = await createFixture();
    const previewFile = join(directory, "previews.json");
    const wallpaperFile = join(directory, "wallpapers.json");
    await Promise.all([writeFile(previewFile, "{broken"), writeFile(wallpaperFile, "{broken")]);

    const [previews, wallpapers] = await Promise.all([
      readPreviewState(createPreviewStateStore(previewFile)),
      readWallpaperState(createWallpaperStateStore(wallpaperFile)),
    ]);

    expect(previews).toEqual({
      ok: false,
      error: { code: "STATE_CORRUPTED", file: previewFile },
    });
    expect(wallpapers).toEqual({
      ok: false,
      error: { code: "STATE_CORRUPTED", file: wallpaperFile },
    });
  });
});

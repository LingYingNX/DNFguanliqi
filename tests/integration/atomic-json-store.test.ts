import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createAtomicJsonStore } from "../../src/core/state/atomic-json-store";

const SettingsSchema = z.object({
  theme: z.union([z.literal("halo"), z.literal("contrast")]),
  gameDirectory: z.string().nullable(),
});

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("atomic JSON store", () => {
  it("round-trips valid state through a real file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dnf-state-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "settings.json");
    const store = createAtomicJsonStore(file, SettingsSchema);

    const writeResult = await store.write({ theme: "halo", gameDirectory: "D:\\DNF" });
    const readResult = await store.read();

    expect(writeResult).toEqual({ ok: true, value: undefined });
    expect(readResult).toEqual({
      ok: true,
      value: { theme: "halo", gameDirectory: "D:\\DNF" },
    });
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual(
      readResult.ok ? readResult.value : null,
    );
  });

  it("reports corrupted state instead of returning defaults", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dnf-state-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "settings.json");
    await writeFile(file, "{not-json", "utf8");
    const store = createAtomicJsonStore(file, SettingsSchema);

    const result = await store.read();

    expect(result).toEqual({
      ok: false,
      error: {
        code: "STATE_CORRUPTED",
        file,
      },
    });
  });

  it("keeps the previous bytes and cleans the temporary file when replacement fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dnf-state-"));
    temporaryDirectories.push(directory);
    const file = join(directory, "settings.json");
    const store = createAtomicJsonStore(file, SettingsSchema, {
      rename: async () => {
        throw new Error("replacement failed");
      },
    });
    await writeFile(file, '{"theme":"halo","gameDirectory":null}\n', "utf8");

    const result = await store.write({ theme: "contrast", gameDirectory: "D:\\DNF" });
    const directoryEntries = await readdir(directory);

    expect(result).toEqual({ ok: false, error: { code: "STATE_IO", file } });
    expect(await readFile(file, "utf8")).toBe('{"theme":"halo","gameDirectory":null}\n');
    expect(directoryEntries.filter((entry) => entry.endsWith(".tmp"))).toEqual([]);
  });
});

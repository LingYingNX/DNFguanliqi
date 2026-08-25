import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyLibraryPreview } from "../../src/core/library/library-preview";
import { resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("library preview files", () => {
  it("copies a patch preview beside the patch and removes older same-name images", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-preview-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    const category = join(libraryRoot, "Armor");
    const source = join(projectRoot, "selected.PNG");
    await mkdir(category, { recursive: true });
    await Promise.all([
      writeFile(join(category, "A.npk"), "patch"),
      writeFile(join(category, "A.jpg"), "old jpg"),
      writeFile(join(category, "A.webp"), "old webp"),
      writeFile(join(category, "other.png"), "keep"),
      writeFile(source, "new preview"),
    ]);

    const result = await copyLibraryPreview({
      libraryRoot,
      kind: "patch",
      relativePath: "Armor\\A.npk",
      sourcePath: source,
    });

    expect(result).toEqual({
      ok: true,
      value: { previewRelativePath: "Armor\\A.png" },
    });
    expect(await readFile(join(category, "A.png"), "utf8")).toBe("new preview");
    await expect(access(join(category, "A.jpg"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(category, "A.webp"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readdir(category)).toEqual(
      expect.arrayContaining(["A.npk", "A.png", "other.png"]),
    );
  });

  it("keeps the target when an existing preview differs only by extension case", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-preview-case-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    const category = join(libraryRoot, "Armor");
    const source = join(projectRoot, "selected.png");
    await mkdir(category, { recursive: true });
    await Promise.all([
      writeFile(join(category, "A.npk"), "patch"),
      writeFile(join(category, "A.PNG"), "old preview"),
      writeFile(source, "new preview"),
    ]);

    const result = await copyLibraryPreview({
      libraryRoot,
      kind: "patch",
      relativePath: "Armor\\A.npk",
      sourcePath: source,
    });

    expect(result.ok).toBe(true);
    await expect(readFile(join(category, "A.png"), "utf8")).resolves.toBe("new preview");
  });

  it("copies a group preview into the group directory using the group name", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-group-preview-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    const group = join(libraryRoot, "Armor", "Set");
    const source = join(projectRoot, "selected.jpeg");
    await Promise.all([mkdir(group, { recursive: true }), writeFile(source, "group preview")]);

    const result = await copyLibraryPreview({
      libraryRoot,
      kind: "group",
      relativePath: "Armor\\Set",
      sourcePath: source,
    });

    expect(result).toEqual({
      ok: true,
      value: { previewRelativePath: "Armor\\Set\\Set.jpeg" },
    });
    expect(await readFile(join(group, "Set.jpeg"), "utf8")).toBe("group preview");
  });

  it("rejects unsupported images and paths outside the library", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-preview-invalid-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    const source = join(projectRoot, "selected.txt");
    await writeFile(source, "not an image");

    await expect(
      copyLibraryPreview({
        libraryRoot,
        kind: "patch",
        relativePath: "A.npk",
        sourcePath: source,
      }),
    ).resolves.toEqual({ ok: false, error: { code: "UNSUPPORTED_IMAGE" } });

    await expect(
      copyLibraryPreview({
        libraryRoot,
        kind: "patch",
        relativePath: "..\\outside\\A.npk",
        sourcePath: join(projectRoot, "selected.png"),
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "PATH_OUTSIDE_LIBRARY", relativePath: "..\\outside" },
    });
  });
});

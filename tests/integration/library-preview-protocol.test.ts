import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  libraryPreviewUrl,
  readLibraryPreviewFile,
  resolveLibraryPreviewUrl,
} from "../../src/core/library/library-preview";
import { resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("library preview protocol", () => {
  it("creates and resolves a safe library preview URL", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-protocol-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    await mkdir(join(libraryRoot, "Armor"), { recursive: true });

    const url = libraryPreviewUrl("Armor\\A.png");

    expect(url).toBe("dnf-library://library/Armor%5CA.png");
    expect(resolveLibraryPreviewUrl(libraryRoot, url)).toEqual({
      ok: true,
      value: join(libraryRoot, "Armor", "A.png"),
    });

    const versionedUrl = libraryPreviewUrl("Armor\\A.png", 123456789n);
    expect(versionedUrl).toBe("dnf-library://library/Armor%5CA.png?v=123456789");
    expect(resolveLibraryPreviewUrl(libraryRoot, versionedUrl)).toEqual({
      ok: true,
      value: join(libraryRoot, "Armor", "A.png"),
    });
  });

  it("rejects traversal, absolute paths, query strings, hashes, and unsupported extensions", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-protocol-invalid-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });

    const invalidUrls = [
      "dnf-library://library/..%5Csecret.png",
      "dnf-library://library/C%3A%5Csecret.png",
      "dnf-library://library/Armor%5CA.png?download=1",
      "dnf-library://library/Armor%5CA.png?v=1.5",
      "dnf-library://library/Armor%5CA.png?v=1&v=2",
      "dnf-library://library/Armor%5CA.png#preview",
      "dnf-library://library/Armor/A.png",
      "dnf-library://library/Armor%5CA.txt",
      "dnf-asset://preview/A.png",
    ];

    for (const url of invalidUrls) {
      expect(resolveLibraryPreviewUrl(libraryRoot, url)).toEqual({
        ok: false,
        error: { code: "LIBRARY_PREVIEW_URL_INVALID" },
      });
    }
  });

  it("reads an existing image and rejects a missing image", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-protocol-read-"));
    temporaryDirectories.push(projectRoot);
    const { libraryRoot } = resolveAppPaths({ mode: "development", projectRoot });
    const category = join(libraryRoot, "Armor");
    await mkdir(category, { recursive: true });
    await writeFile(join(category, "A.jpg"), "preview bytes");

    const existing = await readLibraryPreviewFile(libraryRoot, libraryPreviewUrl("Armor\\A.jpg"));
    expect(existing.ok).toBe(true);
    if (existing.ok) {
      expect(existing.value.contentType).toBe("image/jpeg");
      expect(existing.value.data.toString("utf8")).toBe("preview bytes");
    }

    await expect(
      readLibraryPreviewFile(libraryRoot, libraryPreviewUrl("Armor\\Missing.png")),
    ).resolves.toEqual({
      ok: false,
      error: { code: "LIBRARY_PREVIEW_NOT_FOUND" },
    });
    await expect(access(join(category, "A.jpg"))).resolves.toBeUndefined();
  });
});

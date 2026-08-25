import { describe, expect, it } from "vitest";
import { resolveLibraryPath } from "../../src/core/paths/library-path";
import { resolveAppPaths } from "../../src/main/app-paths";

const libraryRoot = resolveAppPaths({
  mode: "development",
  projectRoot: "C:\\workspace\\dnf-rewrite",
}).libraryRoot;

describe("library path boundary", () => {
  it("resolves a path that stays inside the library", () => {
    const result = resolveLibraryPath(libraryRoot, "鬼剑士男\\coat.npk");

    expect(result).toEqual({
      ok: true,
      value: "C:\\workspace\\dnf-rewrite\\patch-categories\\鬼剑士男\\coat.npk",
    });
  });

  it.each(["..\\outside.npk", "C:\\outside.npk", "..\\patch-categories-old\\outside.npk"])(
    "rejects a path outside the library: %s",
    (relativePath) => {
      const result = resolveLibraryPath(libraryRoot, relativePath);

      expect(result).toEqual({
        ok: false,
        error: {
          code: "PATH_OUTSIDE_LIBRARY",
          relativePath,
        },
      });
    },
  );
});

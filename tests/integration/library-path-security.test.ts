import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveLibraryPath } from "../../src/core/paths/library-path";
import { resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("library path filesystem boundary", () => {
  it("rejects a junction that points outside the library root", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-library-path-"));
    temporaryDirectories.push(projectRoot);
    const paths = resolveAppPaths({ mode: "development", projectRoot });
    const outside = join(projectRoot, "outside");
    await mkdir(outside, { recursive: true });
    await mkdir(paths.libraryRoot, { recursive: true });
    await symlink(outside, join(paths.libraryRoot, "linked"), "junction");

    expect(resolveLibraryPath(paths.libraryRoot, "linked\\escape.npk")).toEqual({
      ok: false,
      error: { code: "PATH_OUTSIDE_LIBRARY", relativePath: "linked\\escape.npk" },
    });
  });
});

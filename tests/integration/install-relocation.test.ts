import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeFileTransaction } from "../../src/core/filesystem/file-transaction";
import { createInstallService } from "../../src/core/install/install-service";
import { parseGameRoot, resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "dnf-install-relocation-"));
  temporaryDirectories.push(root);
  const paths = resolveAppPaths({ mode: "development", projectRoot: root });
  const gameRoot = parseGameRoot(join(root, "game"));
  await Promise.all([mkdir(paths.libraryRoot, { recursive: true }), mkdir(gameRoot)]);
  await Promise.all([
    writeFile(join(paths.libraryRoot, "first.npk"), "first"),
    writeFile(join(paths.libraryRoot, "second.npk"), "second"),
  ]);
  await createInstallService({ ...paths, gameRoot }).enableMany([
    { kind: "patch", relativePath: "first.npk" },
    { kind: "patch", relativePath: "second.npk" },
  ]);
  return { paths, gameRoot };
}

const requests = [
  { kind: "patch", fromRelativePath: "first.npk", toRelativePath: "first-new.npk" },
  { kind: "patch", fromRelativePath: "second.npk", toRelativePath: "second-new.npk" },
] as const;

describe("installation relocation", () => {
  it("relocates every installed target and record in one command", async () => {
    const { paths, gameRoot } = await createFixture();

    const result = await createInstallService({ ...paths, gameRoot }).relocateMany(requests);

    expect(result).toEqual({ ok: true, value: { updatedCount: 2 } });
    expect(await readFile(join(gameRoot, "first-new.npk"), "utf8")).toBe("first");
    expect(await readFile(join(gameRoot, "second-new.npk"), "utf8")).toBe("second");
    const state = JSON.parse(
      await readFile(join(paths.dataRoot, "installation-state.json"), "utf8"),
    );
    expect(
      state.records.map((record: { sourceRelativePath: string }) => record.sourceRelativePath),
    ).toEqual(["first-new.npk", "second-new.npk"]);
  });

  it("does not relocate any target when a later destination is occupied", async () => {
    const { paths, gameRoot } = await createFixture();
    await writeFile(join(gameRoot, "second-new.npk"), "occupied");
    const statePath = join(paths.dataRoot, "installation-state.json");
    const beforeState = await readFile(statePath);

    const result = await createInstallService({ ...paths, gameRoot }).relocateMany(requests);

    expect(result).toEqual({
      ok: false,
      error: { code: "TARGET_CONFLICT", targetPath: join(gameRoot, "second-new.npk") },
    });
    expect(await readFile(join(gameRoot, "first.npk"), "utf8")).toBe("first");
    expect(await readFile(join(gameRoot, "second.npk"), "utf8")).toBe("second");
    await expect(access(join(gameRoot, "first-new.npk"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(statePath)).toEqual(beforeState);
  });

  it("restores every installed file and exact state when a later relocation fails", async () => {
    // Given: two enabled patches and an injected failure after the first target is renamed.
    const { paths, gameRoot } = await createFixture();
    const statePath = join(paths.dataRoot, "installation-state.json");
    const beforeState = await readFile(statePath);
    const service = createInstallService({
      ...paths,
      gameRoot,
      executeTransaction: async (steps) => {
        const [firstStep, ...remainingSteps] = steps;
        if (firstStep === undefined) return executeFileTransaction(steps);
        return executeFileTransaction([
          firstStep,
          {
            apply: async () => {
              throw new Error("injected second relocation failure");
            },
            compensate: async () => {},
          },
          ...remainingSteps,
        ]);
      },
    });

    // When: both installation records are relocated in one command.
    const result = await service.relocateMany(requests);

    // Then: neither game target nor the persisted installation state changes.
    expect(result).toEqual({ ok: false, error: { code: "TRANSACTION_FAILED" } });
    expect(await readFile(join(gameRoot, "first.npk"), "utf8")).toBe("first");
    expect(await readFile(join(gameRoot, "second.npk"), "utf8")).toBe("second");
    await expect(access(join(gameRoot, "first-new.npk"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(gameRoot, "second-new.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(statePath)).toEqual(beforeState);
  });
});

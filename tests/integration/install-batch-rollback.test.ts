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

describe("batch install rollback", () => {
  it("prepares every disable step without mutating game or state", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-disable-plan-"));
    temporaryDirectories.push(projectRoot);
    const paths = resolveAppPaths({ mode: "development", projectRoot });
    const gameRoot = parseGameRoot(join(projectRoot, "game"));
    await Promise.all([mkdir(paths.libraryRoot), mkdir(gameRoot)]);
    await Promise.all([
      writeFile(join(paths.libraryRoot, "first.npk"), "first"),
      writeFile(join(paths.libraryRoot, "second.npk"), "second"),
    ]);
    const items = [
      { kind: "patch", relativePath: "first.npk" },
      { kind: "patch", relativePath: "second.npk" },
    ] as const;
    const service = createInstallService({
      ...paths,
      gameRoot,
      createId: () => "bbfa906c-b853-4424-b053-11b21e364f4b",
    });
    await service.enableMany(items);
    const statePath = join(paths.dataRoot, "installation-state.json");
    const beforeState = await readFile(statePath);

    const plan = await service.prepareDisableMany(items);

    expect(plan.ok).toBe(true);
    expect(await readFile(join(gameRoot, "first.npk"), "utf8")).toBe("first");
    expect(await readFile(join(gameRoot, "second.npk"), "utf8")).toBe("second");
    expect(await readFile(statePath)).toEqual(beforeState);
    if (!plan.ok) return;
    expect(await executeFileTransaction(plan.value.steps)).toEqual({ ok: true, value: undefined });
    await plan.value.cleanup();
    await expect(access(join(gameRoot, "first.npk"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(gameRoot, "second.npk"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("restores every target and exact state when disable fails after the first deletion", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "dnf-disable-rollback-"));
    temporaryDirectories.push(projectRoot);
    const paths = resolveAppPaths({ mode: "development", projectRoot });
    const gameRoot = parseGameRoot(join(projectRoot, "game"));
    await Promise.all([mkdir(paths.libraryRoot), mkdir(gameRoot)]);
    await Promise.all([
      writeFile(join(paths.libraryRoot, "first.npk"), "first"),
      writeFile(join(paths.libraryRoot, "second.npk"), "second"),
    ]);
    const items = [
      { kind: "patch", relativePath: "first.npk" },
      { kind: "patch", relativePath: "second.npk" },
    ] as const;
    const setup = createInstallService({ ...paths, gameRoot });
    await setup.enableMany(items);
    const stateFile = join(paths.dataRoot, "installation-state.json");
    const stateBefore = await readFile(stateFile);
    let transactionCount = 0;
    const service = createInstallService({
      ...paths,
      gameRoot,
      executeTransaction: async (steps) => {
        transactionCount += 1;
        if (transactionCount !== 1) {
          return executeFileTransaction(steps);
        }
        const failureIndex = 4;
        return executeFileTransaction([
          ...steps.slice(0, failureIndex),
          {
            apply: async () => {
              throw new Error("injected failure after first deletion");
            },
            compensate: async () => {},
          },
          ...steps.slice(failureIndex),
        ]);
      },
    });

    const result = await service.disableMany(items);

    expect(result).toEqual({ ok: false, error: { code: "TRANSACTION_FAILED" } });
    expect(await readFile(join(gameRoot, "first.npk"), "utf8")).toBe("first");
    expect(await readFile(join(gameRoot, "second.npk"), "utf8")).toBe("second");
    expect(await readFile(stateFile)).toEqual(stateBefore);
  });
});

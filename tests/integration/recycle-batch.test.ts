import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeFileTransaction } from "../../src/core/filesystem/file-transaction";
import { resolveRecyclePath } from "../../src/core/recycle/recycle-items";
import { createRecycleService } from "../../src/core/recycle/recycle-service";
import { resolveAppPaths } from "../../src/main/app-paths";

const temporaryDirectories: string[] = [];
const ids = [
  "a2021aa5-e024-4106-a0a3-f0874d4c9ec9",
  "bbfa906c-b853-4424-b053-11b21e364f4b",
] as const;

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "dnf-recycle-batch-"));
  temporaryDirectories.push(root);
  const paths = resolveAppPaths({ mode: "development", projectRoot: root });
  await mkdir(paths.libraryRoot, { recursive: true });
  await Promise.all([
    writeFile(join(paths.libraryRoot, "first.npk"), "first"),
    writeFile(join(paths.libraryRoot, "second.npk"), "second"),
  ]);
  return paths;
}

const items = [
  { kind: "patch", relativePath: "first.npk" },
  { kind: "patch", relativePath: "second.npk" },
] as const;

function idSequence(): () => string {
  let index = 0;
  return () => ids[index++] ?? crypto.randomUUID();
}

describe("batch recycle", () => {
  it("recycles every item and writes one manifest containing all entries", async () => {
    const paths = await createFixture();
    const service = createRecycleService({ ...paths, createId: idSequence() });

    const result = await service.recycleMany(items);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.entries.map((entry) => entry.id) : []).toEqual(ids);
    const manifest = JSON.parse(await readFile(join(paths.dataRoot, "recycle-bin.json"), "utf8"));
    expect(manifest.items.map((entry: { id: string }) => entry.id)).toEqual(ids);
    await expect(access(join(paths.libraryRoot, "first.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(paths.libraryRoot, "second.npk"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("does not move the first item when the second recycle container is occupied", async () => {
    const paths = await createFixture();
    await mkdir(join(paths.dataRoot, "recycle-bin", ids[1]), { recursive: true });
    const service = createRecycleService({ ...paths, createId: idSequence() });

    const result = await service.recycleMany(items);

    expect(result).toEqual({ ok: false, error: { code: "RECYCLE_IO" } });
    expect(await readFile(join(paths.libraryRoot, "first.npk"), "utf8")).toBe("first");
    expect(await readFile(join(paths.libraryRoot, "second.npk"), "utf8")).toBe("second");
    await expect(access(join(paths.dataRoot, "recycle-bin.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("restores every source when applying a later recycle move fails", async () => {
    const paths = await createFixture();
    const service = createRecycleService({
      ...paths,
      createId: idSequence(),
      executeTransaction: async (steps) =>
        executeFileTransaction([
          ...steps.slice(0, 3),
          {
            apply: async () => {
              throw new Error("injected second recycle move failure");
            },
            compensate: async () => {},
          },
          ...steps.slice(3),
        ]),
    });

    const result = await service.recycleMany(items);

    expect(result).toEqual({ ok: false, error: { code: "TRANSACTION_FAILED" } });
    expect(await readFile(join(paths.libraryRoot, "first.npk"), "utf8")).toBe("first");
    expect(await readFile(join(paths.libraryRoot, "second.npk"), "utf8")).toBe("second");
    await expect(access(join(paths.dataRoot, "recycle-bin.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

describe("recycle path containment", () => {
  const recycleRoot = "C:\\data\\recycle-bin";

  it.each([
    { case: "绝对路径", relativePath: "C:\\Windows\\System32\\evil.npk" },
    { case: "UNC 绝对路径", relativePath: "\\\\server\\share\\evil.npk" },
    { case: "父级穿越", relativePath: "..\\outside.npk" },
    { case: "深层父级穿越", relativePath: "a\\..\\..\\outside.npk" },
  ])("rejects $case outside the recycle root", ({ relativePath }) => {
    expect(resolveRecyclePath(recycleRoot, relativePath)).toBeNull();
  });

  it("resolves a plain child path inside the recycle root", () => {
    expect(resolveRecyclePath(recycleRoot, "id\\patch.npk")).toBe(
      "C:\\data\\recycle-bin\\id\\patch.npk",
    );
  });
});

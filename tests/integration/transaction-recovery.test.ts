import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  configureTransactionRecovery,
  executeFileTransaction,
} from "../../src/core/filesystem/file-transaction";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("transaction recovery journal", () => {
  it("records completed steps, failed compensation and affected paths", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "dnf-transaction-recovery-"));
    roots.push(dataRoot);
    configureTransactionRecovery(dataRoot);

    const result = await executeFileTransaction([
      {
        label: "copy patch",
        paths: ["D:\\DNF\\coat.npk"],
        apply: async () => undefined,
        compensate: async () => {
          throw new Error("rollback failed");
        },
      },
      {
        label: "write state",
        apply: async () => {
          throw new Error("apply failed");
        },
        compensate: async () => undefined,
      },
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("ROLLBACK_FAILED");
    const files = await readdir(join(dataRoot, "transaction-recovery"));
    expect(files).toHaveLength(1);
    const journalName = files[0];
    if (journalName === undefined) throw new Error("Recovery journal was not created");
    const journal = JSON.parse(
      await readFile(join(dataRoot, "transaction-recovery", journalName), "utf8"),
    );
    expect(journal).toMatchObject({
      completedSteps: ["copy patch"],
      failedCompensations: ["copy patch"],
      affectedPaths: ["D:\\DNF\\coat.npk"],
    });
  });
});

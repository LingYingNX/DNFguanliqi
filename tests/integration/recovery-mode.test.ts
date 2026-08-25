import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveAppPaths } from "../../src/main/app-paths";
import { inspectRecoveryState } from "../../src/main/ipc/recovery-mode";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("read-only recovery mode", () => {
  it("treats missing state as healthy defaults", async () => {
    const root = await mkdtemp(join(tmpdir(), "dnf-recovery-"));
    roots.push(root);

    expect(
      await inspectRecoveryState(resolveAppPaths({ mode: "development", projectRoot: root })),
    ).toEqual({ readOnly: false, files: [] });
  });

  it("reports every corrupted critical state file without modifying it", async () => {
    const root = await mkdtemp(join(tmpdir(), "dnf-recovery-"));
    roots.push(root);
    const paths = resolveAppPaths({ mode: "development", projectRoot: root });
    const settings = join(paths.dataRoot, "settings.json");
    const previews = join(paths.dataRoot, "previews.json");
    const presets = join(paths.dataRoot, "presets.json");
    await mkdir(paths.dataRoot, { recursive: true });
    await writeFile(settings, "broken-settings");
    await writeFile(previews, "broken-previews");
    await writeFile(presets, "broken-presets");

    expect(await inspectRecoveryState(paths)).toEqual({
      readOnly: true,
      files: [settings, previews, presets],
    });
  });
});

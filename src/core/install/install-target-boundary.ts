import { realpath } from "node:fs/promises";
import { win32 } from "node:path";
import type { GameRoot } from "../../main/app-paths";
import { normalizedPathKey } from "../paths/relative-path";

export async function assertInstallTargetBoundary(
  gameRoot: GameRoot,
  targetPath: string,
): Promise<void> {
  if (normalizedPathKey(win32.dirname(targetPath)) !== normalizedPathKey(gameRoot)) {
    throw new Error("Installation target is outside the game directory");
  }
  if (normalizedPathKey(await realpath(gameRoot)) !== normalizedPathKey(gameRoot)) {
    throw new Error("Game directory identity changed");
  }
}

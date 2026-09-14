import { realpath } from "node:fs/promises";
import { win32 } from "node:path";
import type { GameRoot } from "../../main/app-paths";

function identity(path: string): string {
  return win32.normalize(path).toLocaleLowerCase();
}

export async function assertInstallTargetBoundary(
  gameRoot: GameRoot,
  targetPath: string,
): Promise<void> {
  if (identity(win32.dirname(targetPath)) !== identity(gameRoot)) {
    throw new Error("Installation target is outside the game directory");
  }
  if (identity(await realpath(gameRoot)) !== identity(gameRoot)) {
    throw new Error("Game directory identity changed");
  }
}

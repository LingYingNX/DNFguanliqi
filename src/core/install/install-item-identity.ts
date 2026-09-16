import { err, ok, type Result } from "../../shared/result";
import { normalizedPathKey } from "../paths/relative-path";
import type { InstallItem, InstallServiceError } from "./install-service";

export function rejectDuplicateItems(
  items: readonly InstallItem[],
): Result<void, InstallServiceError> {
  const paths = new Set<string>();
  for (const item of items) {
    const normalized =
      item.kind === "patch"
        ? `patch:${normalizedPathKey(item.relativePath)}`
        : `group:${item.groupId.toLocaleLowerCase()}`;
    if (paths.has(normalized)) {
      return err({
        code: "DUPLICATE_ITEM",
        relativePath: item.kind === "patch" ? item.relativePath : item.groupId,
      });
    }
    paths.add(normalized);
  }
  return ok(undefined);
}

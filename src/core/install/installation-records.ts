import { win32 } from "node:path";
import type { InstallationRecord } from "../state/schemas";

export function installationRecordsForItem(
  records: readonly InstallationRecord[],
  kind: "patch" | "group",
  relativePath: string,
): readonly InstallationRecord[] {
  return kind === "patch"
    ? records.filter((record) => record.sourceRelativePath === relativePath)
    : records.filter((record) => win32.dirname(record.sourceRelativePath) === relativePath);
}

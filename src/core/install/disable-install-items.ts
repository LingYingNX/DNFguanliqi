import { COPYFILE_EXCL } from "node:constants";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { win32 } from "node:path";
import { err, ok, type Result } from "../../shared/result";
import type { FileTransactionStep } from "../filesystem/file-transaction";
import { hashFile } from "../filesystem/hash-file";
import { pathExists } from "../filesystem/path-exists";
import type { InstallationRecord, InstallationState } from "../state/schemas";
import { rejectDuplicateItems } from "./install-item-identity";
import type { InstallBatchContext, InstallItem, InstallServiceError } from "./install-service";
import { resolveInstallMemberPaths } from "./install-sources";
import { assertInstallTargetBoundary } from "./install-target-boundary";
import {
  readInstallationState,
  restoreInstallationState,
  writeInstallationState,
} from "./installation-state";

export type DisableInstallItemsPlan = {
  readonly cleanup: () => Promise<void>;
  readonly removedCount: number;
  readonly steps: readonly FileTransactionStep[];
};

export async function disableInstallItems(
  context: InstallBatchContext,
  items: readonly InstallItem[],
): Promise<Result<{ readonly removedCount: number }, InstallServiceError>> {
  const planned = await prepareDisableInstallItems(context, items);
  if (!planned.ok) return planned;
  const transaction = await context.executeTransaction(planned.value.steps);
  if (!transaction.ok) return transaction;
  await planned.value.cleanup();
  return ok({ removedCount: planned.value.removedCount });
}

export async function prepareDisableInstallItems(
  context: InstallBatchContext,
  items: readonly InstallItem[],
): Promise<Result<DisableInstallItemsPlan, InstallServiceError>> {
  const duplicates = rejectDuplicateItems(items);
  if (!duplicates.ok) return duplicates;
  const snapshot = await readInstallationState(context.store);
  if (!snapshot.ok) return snapshot;
  const recordsResult = await resolveRecords(context, snapshot.value.state.records, items);
  if (!recordsResult.ok) return recordsResult;
  const records = recordsResult.value;
  if (records.length === 0) {
    return ok({ cleanup: async () => {}, removedCount: 0, steps: [] });
  }

  try {
    const liveRecords: InstallationRecord[] = [];
    for (const record of records) {
      if (!(await pathExists(record.targetPath))) continue;
      if ((await hashFile(record.targetPath)) !== record.targetHash) {
        return err({ code: "TARGET_MODIFIED", targetPath: record.targetPath });
      }
      liveRecords.push(record);
    }
    const transactionId = context.createId();
    const backupRoot = win32.join(context.dataRoot, "install-transactions", transactionId);
    const backupPath = (record: InstallationRecord): string =>
      win32.join(backupRoot, win32.basename(record.targetPath));
    const removedPaths = new Set(records.map((record) => record.sourceRelativePath));
    const nextState: InstallationState = {
      ...snapshot.value.state,
      records: snapshot.value.state.records.filter(
        (record) => !removedPaths.has(record.sourceRelativePath),
      ),
    };
    const steps: FileTransactionStep[] = [
      ...(liveRecords.length === 0
        ? []
        : [
            {
              apply: async () => {
                await mkdir(backupRoot, { recursive: true });
              },
              compensate: async () => {
                await rm(backupRoot, { force: true, recursive: true });
              },
            },
            ...liveRecords.map(
              (record): FileTransactionStep => ({
                apply: () => copyFile(record.targetPath, backupPath(record)),
                compensate: () => rm(backupPath(record), { force: true }),
              }),
            ),
            ...liveRecords.map(
              (record): FileTransactionStep => ({
                apply: async () => {
                  await assertInstallTargetBoundary(context.gameRoot, record.targetPath);
                  await rm(record.targetPath);
                },
                compensate: async () => {
                  await assertInstallTargetBoundary(context.gameRoot, record.targetPath);
                  await copyFile(backupPath(record), record.targetPath, COPYFILE_EXCL);
                },
              }),
            ),
          ]),
      {
        apply: () => writeInstallationState(context.store, nextState),
        compensate: () =>
          restoreInstallationState(context.store, context.stateFile, snapshot.value),
      },
    ];
    return ok({
      cleanup: () => rm(backupRoot, { force: true, recursive: true }),
      removedCount: records.length,
      steps,
    });
  } catch (error) {
    if (error instanceof Error) return err({ code: "INSTALL_IO" });
    throw error;
  }
}

async function resolveRecords(
  context: InstallBatchContext,
  records: readonly InstallationRecord[],
  items: readonly InstallItem[],
): Promise<Result<readonly InstallationRecord[], InstallServiceError>> {
  const selectedPaths = new Set<string>();
  for (const item of items) {
    const paths = await resolveInstallMemberPaths(item, context.groups);
    if (!paths.ok) return paths;
    for (const path of paths.value) selectedPaths.add(path);
  }
  return ok(records.filter((record) => selectedPaths.has(record.sourceRelativePath)));
}

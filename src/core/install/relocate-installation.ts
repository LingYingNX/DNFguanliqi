import { COPYFILE_EXCL } from "node:constants";
import { copyFile, rm } from "node:fs/promises";
import { win32 } from "node:path";
import { err, ok, type Result } from "../../shared/result";
import type { FileTransactionStep } from "../filesystem/file-transaction";
import { hashFile } from "../filesystem/hash-file";
import { pathExists } from "../filesystem/path-exists";
import type { InstallationRecord, InstallationState } from "../state/schemas";
import type { InstallBatchContext, InstallServiceError } from "./install-service";
import { assertInstallTargetBoundary } from "./install-target-boundary";
import { installationRecordsForItem } from "./installation-records";
import {
  readInstallationState,
  restoreInstallationState,
  writeInstallationState,
} from "./installation-state";

export type RelocateInstallationRequest = {
  readonly kind: "patch" | "group";
  readonly fromRelativePath: string;
  readonly toRelativePath: string;
};

type Relocation = {
  readonly record: InstallationRecord;
  readonly nextRecord: InstallationRecord;
};

export type RelocateInstallationsPlan = {
  readonly steps: readonly FileTransactionStep[];
  readonly updatedCount: number;
};

function identity(path: string): string {
  return win32.normalize(path).toLocaleLowerCase();
}

function relocatedSourcePath(
  record: InstallationRecord,
  request: RelocateInstallationRequest,
): string {
  return request.kind === "patch"
    ? request.toRelativePath
    : win32.join(request.toRelativePath, win32.basename(record.sourceRelativePath));
}

export async function relocateInstallations(
  context: InstallBatchContext,
  requests: readonly RelocateInstallationRequest[],
): Promise<Result<{ readonly updatedCount: number }, InstallServiceError>> {
  const planned = await prepareRelocateInstallations(context, requests);
  if (!planned.ok) return planned;
  const transaction = await context.executeTransaction(planned.value.steps);
  return transaction.ok ? ok({ updatedCount: planned.value.updatedCount }) : transaction;
}

export async function prepareRelocateInstallations(
  context: InstallBatchContext,
  requests: readonly RelocateInstallationRequest[],
): Promise<Result<RelocateInstallationsPlan, InstallServiceError>> {
  const seenSources = new Set<string>();
  for (const request of requests) {
    const sourceIdentity = identity(request.fromRelativePath);
    if (seenSources.has(sourceIdentity)) {
      return err({ code: "DUPLICATE_ITEM", relativePath: request.fromRelativePath });
    }
    seenSources.add(sourceIdentity);
  }
  const snapshot = await readInstallationState(context.store);
  if (!snapshot.ok) return snapshot;

  try {
    const relocations: Relocation[] = [];
    const selectedRecords = new Set<string>();
    const nextSources = new Set<string>();
    const nextTargets = new Set<string>();
    for (const request of requests) {
      const records = installationRecordsForItem(
        snapshot.value.state.records,
        request.kind,
        request.fromRelativePath,
      );
      for (const record of records) {
        const recordIdentity = identity(record.sourceRelativePath);
        if (selectedRecords.has(recordIdentity)) {
          return err({ code: "DUPLICATE_ITEM", relativePath: record.sourceRelativePath });
        }
        selectedRecords.add(recordIdentity);
        if (!(await pathExists(record.targetPath))) {
          return err({ code: "TARGET_MISSING", targetPath: record.targetPath });
        }
        if ((await hashFile(record.targetPath)) !== record.targetHash) {
          return err({ code: "TARGET_MODIFIED", targetPath: record.targetPath });
        }
        const nextSourcePath = relocatedSourcePath(record, request);
        const nextTargetPath = win32.join(context.gameRoot, win32.basename(nextSourcePath));
        const nextSourceIdentity = identity(nextSourcePath);
        const nextTargetIdentity = identity(nextTargetPath);
        if (nextSources.has(nextSourceIdentity) || nextTargets.has(nextTargetIdentity)) {
          return err({ code: "TARGET_CONFLICT", targetPath: nextTargetPath });
        }
        nextSources.add(nextSourceIdentity);
        nextTargets.add(nextTargetIdentity);
        if (nextTargetPath !== record.targetPath && (await pathExists(nextTargetPath))) {
          return err({ code: "TARGET_CONFLICT", targetPath: nextTargetPath });
        }
        relocations.push({
          record,
          nextRecord: { ...record, sourceRelativePath: nextSourcePath, targetPath: nextTargetPath },
        });
      }
    }
    if (relocations.length === 0) return ok({ updatedCount: 0, steps: [] });

    const updates = new Map(
      relocations.map(({ record, nextRecord }) => [record.sourceRelativePath, nextRecord]),
    );
    const nextState: InstallationState = {
      ...snapshot.value.state,
      records: snapshot.value.state.records.map(
        (record) => updates.get(record.sourceRelativePath) ?? record,
      ),
    };
    const steps: FileTransactionStep[] = [
      ...relocations
        .filter(({ record, nextRecord }) => record.targetPath !== nextRecord.targetPath)
        .map(
          ({ record, nextRecord }): FileTransactionStep => ({
            apply: async () => {
              await assertInstallTargetBoundary(context.gameRoot, record.targetPath);
              await assertInstallTargetBoundary(context.gameRoot, nextRecord.targetPath);
              await copyFile(record.targetPath, nextRecord.targetPath, COPYFILE_EXCL);
            },
            compensate: async () => {
              await assertInstallTargetBoundary(context.gameRoot, nextRecord.targetPath);
              await rm(nextRecord.targetPath, { force: true });
            },
          }),
        ),
      ...relocations
        .filter(({ record, nextRecord }) => record.targetPath !== nextRecord.targetPath)
        .map(
          ({ record, nextRecord }): FileTransactionStep => ({
            apply: async () => {
              await assertInstallTargetBoundary(context.gameRoot, record.targetPath);
              await rm(record.targetPath);
            },
            compensate: async () => {
              await assertInstallTargetBoundary(context.gameRoot, record.targetPath);
              await copyFile(nextRecord.targetPath, record.targetPath, COPYFILE_EXCL);
            },
          }),
        ),
      {
        apply: () => writeInstallationState(context.store, nextState),
        compensate: () =>
          restoreInstallationState(context.store, context.stateFile, snapshot.value),
      },
    ];
    return ok({ updatedCount: relocations.length, steps });
  } catch (error) {
    if (error instanceof Error) return err({ code: "INSTALL_IO" });
    throw error;
  }
}

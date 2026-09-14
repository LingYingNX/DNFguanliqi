import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { win32 } from "node:path";
import { err, ok, type Result } from "../../shared/result";

export type FileTransactionError =
  | { readonly code: "TRANSACTION_FAILED" }
  | { readonly code: "ROLLBACK_FAILED"; readonly journalPath?: string };

export type FileTransactionStep = {
  readonly apply: () => Promise<void>;
  readonly compensate: () => Promise<void>;
  readonly label?: string;
  readonly paths?: readonly string[];
};

let recoveryRoot: string | null = null;

export function configureTransactionRecovery(dataRoot: string): void {
  recoveryRoot = win32.join(dataRoot, "transaction-recovery");
}

async function writeRecoveryJournal(
  completed: readonly FileTransactionStep[],
  failedCompensation: FileTransactionStep,
): Promise<string | undefined> {
  if (recoveryRoot === null) return undefined;
  const id = randomUUID();
  const journalPath = win32.join(recoveryRoot, `${id}.json`);
  const label = (step: FileTransactionStep, index: number) => step.label ?? `step-${index + 1}`;
  const payload = {
    formatVersion: 1,
    transactionId: id,
    createdAt: new Date().toISOString(),
    completedSteps: completed.map(label),
    failedCompensations: [label(failedCompensation, completed.indexOf(failedCompensation))],
    affectedPaths: [...new Set(completed.flatMap((step) => step.paths ?? []))],
  };
  try {
    await mkdir(recoveryRoot, { recursive: true });
    await writeFile(journalPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
    return journalPath;
  } catch (error) {
    if (error instanceof Error) return undefined;
    throw error;
  }
}

export async function executeFileTransaction(
  steps: readonly FileTransactionStep[],
): Promise<Result<void, FileTransactionError>> {
  const completed: FileTransactionStep[] = [];

  try {
    for (const step of steps) {
      await step.apply();
      completed.push(step);
    }
    return ok(undefined);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }

    try {
      for (const step of [...completed].reverse()) {
        try {
          await step.compensate();
        } catch (rollbackError) {
          if (rollbackError instanceof Error) {
            const journalPath = await writeRecoveryJournal(completed, step);
            return err(
              journalPath === undefined
                ? { code: "ROLLBACK_FAILED" }
                : { code: "ROLLBACK_FAILED", journalPath },
            );
          }
          throw rollbackError;
        }
      }
    } catch (rollbackError) {
      if (!(rollbackError instanceof Error)) throw rollbackError;
    }
    return err({ code: "TRANSACTION_FAILED" });
  }
}

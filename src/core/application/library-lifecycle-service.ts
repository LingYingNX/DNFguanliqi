import { win32 } from "node:path";
import type { LibraryRoot } from "../../main/app-paths";
import { ok, type Result } from "../../shared/result";
import { executeFileTransaction } from "../filesystem/file-transaction";
import type { VirtualGroupService, VirtualGroupServiceError } from "../groups/group-service";
import type {
  FileTransactionExecutor,
  InstallService,
  InstallServiceError,
} from "../install/install-service";
import {
  type MoveLibraryItemError,
  type MoveLibraryPatchRequest,
  prepareMoveLibraryItem,
} from "../library/move-library-item";
import {
  type MoveLibraryItemsError,
  type MoveLibraryItemsItem,
  prepareMoveLibraryItems,
} from "../library/move-library-items";
import type { PreviewService, PreviewServiceError } from "../previews/preview-service";
import type { RecycleItem, RecycleService, RecycleServiceError } from "../recycle/recycle-service";
import type { RecycleEntry } from "../state/schemas";

type LibraryLifecycleOptions = {
  readonly groups?: VirtualGroupService | undefined;
  readonly libraryRoot: LibraryRoot;
  readonly install: InstallService;
  readonly previews?: PreviewService | undefined;
  readonly recycle: RecycleService;
  readonly executeTransaction?: FileTransactionExecutor;
};

export type LibraryLifecycleError =
  | MoveLibraryItemError
  | MoveLibraryItemsError
  | InstallServiceError
  | RecycleServiceError
  | PreviewServiceError
  | VirtualGroupServiceError
  | { readonly code: "GROUP_SERVICE_REQUIRED" }
  | { readonly code: "LIFECYCLE_ROLLBACK_FAILED" };

export interface LibraryLifecycleService {
  recycleMany(
    items: readonly RecycleItem[],
  ): Promise<Result<{ readonly entries: readonly RecycleEntry[] }, LibraryLifecycleError>>;
  moveMany(request: {
    readonly items: readonly Extract<MoveLibraryItemsItem, { readonly kind: "patch" }>[];
    readonly targetDirectoryRelativePath: string;
  }): Promise<Result<{ readonly relativePaths: readonly string[] }, LibraryLifecycleError>>;
  move(
    request: Omit<MoveLibraryPatchRequest, "libraryRoot">,
  ): Promise<Result<{ readonly relativePath: string }, LibraryLifecycleError>>;
  recycle(
    request:
      | {
          readonly kind: "patch";
          readonly relativePath: string;
        }
      | {
          readonly kind: "group";
          readonly groupId: string;
        },
  ): Promise<Result<{ readonly entry: RecycleEntry }, LibraryLifecycleError>>;
  dissolveGroup(request: {
    readonly groupId: string;
  }): Promise<Result<{ readonly id: string }, LibraryLifecycleError>>;
}

export async function dissolveGroupLifecycle(options: {
  readonly groups: VirtualGroupService;
  readonly groupId: string;
  readonly previews?: PreviewService | undefined;
  readonly executeTransaction?: FileTransactionExecutor;
}): Promise<Result<{ readonly id: string }, LibraryLifecycleError>> {
  const libraryPlan = await options.groups.prepareDissolve(options.groupId);
  if (!libraryPlan.ok) return libraryPlan;

  const previewPlan = options.previews
    ? await options.previews.prepareRemoveGroupBindingById(options.groupId)
    : ok({ steps: [] });
  if (!previewPlan.ok) return previewPlan;

  const executeTransaction = options.executeTransaction ?? executeFileTransaction;
  const transaction = await executeTransaction([
    ...libraryPlan.value.steps,
    ...previewPlan.value.steps,
  ]);
  return transaction.ok ? ok({ id: libraryPlan.value.id }) : transaction;
}

export function createLibraryLifecycleService(
  options: LibraryLifecycleOptions,
): LibraryLifecycleService {
  const executeTransaction = options.executeTransaction ?? executeFileTransaction;
  return {
    async recycleMany(items) {
      const disablePlan = await options.install.prepareDisableMany(items);
      if (!disablePlan.ok) return disablePlan;
      const recyclePlan = await options.recycle.prepareRecycleMany(items);
      if (!recyclePlan.ok) return recyclePlan;
      const previewPlan = options.previews
        ? await options.previews.prepareRecycleMany(recyclePlan.value.entries)
        : ok({ steps: [] });
      if (!previewPlan.ok) return previewPlan;
      const transaction = await executeTransaction([
        ...disablePlan.value.steps,
        ...recyclePlan.value.steps,
        ...previewPlan.value.steps,
      ]);
      if (!transaction.ok) return transaction;
      await disablePlan.value.cleanup();
      return { ok: true, value: { entries: recyclePlan.value.entries } };
    },
    async moveMany(request) {
      const libraryPlan = await prepareMoveLibraryItems({
        ...request,
        libraryRoot: options.libraryRoot,
      });
      if (!libraryPlan.ok) return libraryPlan;
      const installationPlan = await options.install.prepareRelocateMany(
        request.items.map((item) => ({
          kind: item.kind,
          fromRelativePath: item.sourceRelativePath,
          toRelativePath: win32.join(
            request.targetDirectoryRelativePath,
            win32.basename(item.sourceRelativePath),
          ),
        })),
      );
      if (!installationPlan.ok) return installationPlan;
      const previewPlan = options.previews
        ? await options.previews.prepareMoveMany(
            request.items.map((item) => ({
              kind: item.kind,
              fromRelativePath: item.sourceRelativePath,
              toRelativePath: win32.join(
                request.targetDirectoryRelativePath,
                win32.basename(item.sourceRelativePath),
              ),
            })),
          )
        : ok({ steps: [] });
      if (!previewPlan.ok) return previewPlan;
      const transaction = await executeTransaction([
        ...libraryPlan.value.steps,
        ...installationPlan.value.steps,
        ...previewPlan.value.steps,
      ]);
      return transaction.ok
        ? { ok: true, value: { relativePaths: libraryPlan.value.relativePaths } }
        : transaction;
    },
    async move(request) {
      const libraryPlan = await prepareMoveLibraryItem({
        ...request,
        libraryRoot: options.libraryRoot,
      });
      if (!libraryPlan.ok) return libraryPlan;
      const installationPlan = await options.install.prepareRelocateMany([
        {
          kind: request.kind,
          fromRelativePath: request.sourceRelativePath,
          toRelativePath: libraryPlan.value.relativePath,
        },
      ]);
      if (!installationPlan.ok) return installationPlan;
      const previewPlan = options.previews
        ? await options.previews.prepareMoveMany([
            {
              kind: request.kind,
              fromRelativePath: request.sourceRelativePath,
              toRelativePath: libraryPlan.value.relativePath,
            },
          ])
        : ok({ steps: [] });
      if (!previewPlan.ok) return previewPlan;
      const transaction = await executeTransaction([
        ...libraryPlan.value.steps,
        ...installationPlan.value.steps,
        ...previewPlan.value.steps,
      ]);
      return transaction.ok ? ok({ relativePath: libraryPlan.value.relativePath }) : transaction;
    },

    dissolveGroup(request) {
      if (options.groups === undefined) {
        return Promise.resolve({
          ok: false,
          error: { code: "GROUP_SERVICE_REQUIRED" },
        } as const);
      }
      return dissolveGroupLifecycle({
        executeTransaction,
        groupId: request.groupId,
        groups: options.groups,
        previews: options.previews,
      });
    },

    async recycle(request) {
      const result = await this.recycleMany([request]);
      if (!result.ok) return result;
      const entry = result.value.entries[0];
      return entry === undefined
        ? { ok: false, error: { code: "RECYCLE_IO" } }
        : { ok: true, value: { entry } };
    },
  };
}

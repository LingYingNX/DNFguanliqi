import type { DataRoot, LibraryRoot } from "../../main/app-paths";
import { err, ok, type Result } from "../../shared/result";
import {
  createVirtualGroupService,
  type VirtualGroupService,
  type VirtualGroupServiceError,
} from "../groups/group-service";
import type { LibraryPathError } from "../paths/library-path";

export type LibraryCommandOverrides = {
  readonly dataRoot?: DataRoot;
  readonly groups?: VirtualGroupService;
};

export type CreateGroupRequest = {
  readonly libraryRoot: LibraryRoot;
  readonly categoryRelativePath: string;
  readonly patchRelativePaths: readonly string[];
  readonly groupName: string;
};

export type CreateGroupResult = {
  readonly id: string;
  readonly categoryRelativePath: string;
};

export type DissolveGroupRequest = {
  readonly groupId: string;
};

export type LibraryCommandError =
  | LibraryPathError
  | VirtualGroupServiceError
  | { readonly code: "GROUP_SERVICE_REQUIRED" };

export interface LibraryCommands {
  createGroup(request: CreateGroupRequest): Promise<Result<CreateGroupResult, LibraryCommandError>>;
  dissolveGroup(
    request: DissolveGroupRequest,
  ): Promise<Result<{ readonly id: string }, LibraryCommandError>>;
}

function createGroupsForLibrary(
  overrides: LibraryCommandOverrides,
  libraryRoot: LibraryRoot,
): VirtualGroupService | null {
  if (overrides.groups !== undefined) return overrides.groups;
  if (overrides.dataRoot === undefined) return null;
  return createVirtualGroupService({ dataRoot: overrides.dataRoot, libraryRoot });
}

export function createLibraryCommands(overrides: LibraryCommandOverrides = {}): LibraryCommands {
  return {
    async createGroup(request) {
      const groups = createGroupsForLibrary(overrides, request.libraryRoot);
      if (groups === null) return err({ code: "GROUP_SERVICE_REQUIRED" });
      const created = await groups.create({
        categoryRelativePath: request.categoryRelativePath,
        memberRelativePaths: request.patchRelativePaths,
        name: request.groupName,
      });
      return created.ok
        ? ok({ id: created.value.id, categoryRelativePath: created.value.categoryRelativePath })
        : created;
    },
    async dissolveGroup(request) {
      const dataRoot = overrides.dataRoot;
      if (overrides.groups !== undefined) {
        return overrides.groups.dissolve(request.groupId);
      }
      if (dataRoot === undefined) {
        return err({ code: "GROUP_SERVICE_REQUIRED" });
      }
      return createVirtualGroupService({
        dataRoot,
        libraryRoot: "virtual-group-state-only" as LibraryRoot,
      }).dissolve(request.groupId);
    },
  };
}

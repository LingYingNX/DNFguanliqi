import { win32 } from "node:path";
import { z } from "zod";
import { ok, type Result } from "../../shared/result";
import { LibraryItemNameSchema } from "../library/library-item-name";
import {
  type AtomicJsonStore,
  createAtomicJsonStore,
  type StateStoreError,
} from "../state/atomic-json-store";

export function normalizeVirtualGroupRelativePath(relativePath: string): string {
  return relativePath === "" ? "" : win32.normalize(relativePath);
}

export function virtualGroupMemberPathKey(relativePath: string): string {
  return normalizeVirtualGroupRelativePath(relativePath).toLocaleLowerCase();
}

function isCanonicalRelativePath(relativePath: string, allowEmpty: boolean): boolean {
  if (relativePath === "") return allowEmpty;
  if (win32.parse(relativePath).root !== "") return false;
  if (win32.isAbsolute(relativePath)) return false;
  if (relativePath === "." || relativePath === "..") return false;
  if (relativePath.startsWith(`..${win32.sep}`)) return false;
  return relativePath === normalizeVirtualGroupRelativePath(relativePath);
}

function parentRelativePath(relativePath: string): string {
  const parent = win32.dirname(relativePath);
  return parent === "." ? "" : parent;
}

export const VirtualGroupSchema = z
  .object({
    id: z.string().uuid(),
    name: LibraryItemNameSchema,
    categoryRelativePath: z.string(),
    memberRelativePaths: z.array(z.string().min(1)).min(2),
    createdAt: z.string().datetime(),
  })
  .superRefine((group, context) => {
    if (!isCanonicalRelativePath(group.categoryRelativePath, true)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The group category path must be canonical and inside the library.",
      });
    }
    for (const memberRelativePath of group.memberRelativePaths) {
      if (!isCanonicalRelativePath(memberRelativePath, false)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A group member path must be canonical and inside the library.",
        });
        continue;
      }
      if (win32.extname(memberRelativePath).toLocaleLowerCase() !== ".npk") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A group member must be an NPK file.",
        });
      }
      if (
        virtualGroupMemberPathKey(parentRelativePath(memberRelativePath)) !==
        virtualGroupMemberPathKey(group.categoryRelativePath)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A group member must be directly inside its group category.",
        });
      }
    }
  });

export type VirtualGroup = z.infer<typeof VirtualGroupSchema>;

export const VirtualGroupsStateSchema = z
  .object({
    formatVersion: z.literal(1),
    groups: z.array(VirtualGroupSchema),
  })
  .superRefine((state, context) => {
    const members = new Set<string>();
    const groupIds = new Set<string>();
    for (const group of state.groups) {
      if (groupIds.has(group.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A virtual group id must be unique.",
        });
      }
      groupIds.add(group.id);
      for (const memberRelativePath of group.memberRelativePaths) {
        const key = virtualGroupMemberPathKey(memberRelativePath);
        if (members.has(key)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A group member cannot belong to more than one group.",
          });
        }
        members.add(key);
      }
    }
  });

export type VirtualGroupsState = z.infer<typeof VirtualGroupsStateSchema>;

export type VirtualGroupsStore = AtomicJsonStore<VirtualGroupsState>;

export function emptyVirtualGroupsState(): VirtualGroupsState {
  return { formatVersion: 1, groups: [] };
}

export function createVirtualGroupsStore(file: string): VirtualGroupsStore {
  const store = createAtomicJsonStore(file, VirtualGroupsStateSchema);
  return {
    async read(): Promise<Result<VirtualGroupsState, StateStoreError>> {
      const result = await store.read();
      return result.ok || result.error.code !== "STATE_MISSING"
        ? result
        : ok(emptyVirtualGroupsState());
    },
    write(value) {
      return store.write(value);
    },
  };
}

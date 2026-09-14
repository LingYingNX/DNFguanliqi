import { randomUUID } from "node:crypto";
import { type FileHandle, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { type ZodType, z } from "zod";
import { err, ok, type Result } from "../../shared/result";

const NodeErrorSchema = z.object({
  code: z.string(),
});

export type StateStoreError =
  | { readonly code: "STATE_MISSING"; readonly file: string }
  | { readonly code: "STATE_CORRUPTED"; readonly file: string }
  | { readonly code: "STATE_IO"; readonly file: string };

export interface AtomicJsonStore<T> {
  read(): Promise<Result<T, StateStoreError>>;
  write(value: T): Promise<Result<void, StateStoreError>>;
}

export type AtomicJsonFileSystem = {
  readonly mkdir: typeof mkdir;
  readonly open: typeof open;
  readonly rename: typeof rename;
  readonly rm: typeof rm;
};

type AtomicJsonFileSystemOverrides = Partial<AtomicJsonFileSystem>;

function stateIo(file: string): Result<never, StateStoreError> {
  return err({ code: "STATE_IO", file });
}

export function createAtomicJsonStore<T>(
  file: string,
  schema: ZodType<T>,
  overrides: AtomicJsonFileSystemOverrides = {},
): AtomicJsonStore<T> {
  const fileSystem: AtomicJsonFileSystem = { mkdir, open, rename, rm, ...overrides };
  return {
    async read(): Promise<Result<T, StateStoreError>> {
      let content: string;
      try {
        content = await readFile(file, "utf8");
      } catch (error) {
        const nodeError = NodeErrorSchema.safeParse(error);
        if (nodeError.success && nodeError.data.code === "ENOENT") {
          return err({ code: "STATE_MISSING", file });
        }
        if (error instanceof Error) {
          return stateIo(file);
        }
        throw error;
      }

      try {
        const raw: unknown = JSON.parse(content);
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          return err({ code: "STATE_CORRUPTED", file });
        }
        return ok(parsed.data);
      } catch (error) {
        if (error instanceof SyntaxError) {
          return err({ code: "STATE_CORRUPTED", file });
        }
        throw error;
      }
    },

    async write(value: T): Promise<Result<void, StateStoreError>> {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        return err({ code: "STATE_CORRUPTED", file });
      }

      await fileSystem.mkdir(dirname(file), { recursive: true });
      const temporaryFile = `${file}.${randomUUID()}.tmp`;

      try {
        const handle: FileHandle = await fileSystem.open(temporaryFile, "wx");
        try {
          await handle.writeFile(`${JSON.stringify(parsed.data, null, 2)}\n`, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        await fileSystem.rename(temporaryFile, file);
        return ok(undefined);
      } catch (error) {
        try {
          await fileSystem.rm(temporaryFile, { force: true });
        } catch (cleanupError) {
          if (!(cleanupError instanceof Error)) {
            throw cleanupError;
          }
        }
        if (error instanceof Error) {
          return stateIo(file);
        }
        throw error;
      }
    },
  };
}

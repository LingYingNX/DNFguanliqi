import { win32 } from "node:path";
import { z } from "zod";

const DataRootSchema = z.string().min(1).brand<"DataRoot">();
const LibraryRootSchema = z.string().min(1).brand<"LibraryRoot">();
const GameRootSchema = z.string().min(1).brand<"GameRoot">();

const AppPathInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("portable"),
    executableDirectory: z.string().min(1),
  }),
  z.object({
    mode: z.literal("development"),
    projectRoot: z.string().min(1),
  }),
]);

export type DataRoot = z.infer<typeof DataRootSchema>;
export type LibraryRoot = z.infer<typeof LibraryRootSchema>;
export type GameRoot = z.infer<typeof GameRootSchema>;
export type AppPathInput = z.input<typeof AppPathInputSchema>;

export type AppPaths = {
  readonly dataRoot: DataRoot;
  readonly libraryRoot: LibraryRoot;
};

export function parseGameRoot(value: string): GameRoot {
  return GameRootSchema.parse(win32.resolve(value));
}

class UnreachableAppModeError extends Error {
  override readonly name = "UnreachableAppModeError";

  constructor(cause: never) {
    super("Unexpected application path mode", { cause });
  }
}

function unreachableMode(value: never): never {
  throw new UnreachableAppModeError(value);
}

export function resolveAppPaths(input: AppPathInput): AppPaths {
  const parsed = AppPathInputSchema.parse(input);

  switch (parsed.mode) {
    case "portable": {
      return {
        dataRoot: DataRootSchema.parse(win32.join(parsed.executableDirectory, "data")),
        libraryRoot: LibraryRootSchema.parse(
          win32.join(parsed.executableDirectory, "patch-categories"),
        ),
      };
    }
    case "development":
      return {
        dataRoot: DataRootSchema.parse(win32.join(parsed.projectRoot, "data")),
        libraryRoot: LibraryRootSchema.parse(win32.join(parsed.projectRoot, "patch-categories")),
      };
    default:
      return unreachableMode(parsed);
  }
}

export function resolveRuntimeAppPaths(input: {
  readonly isPackaged: boolean;
  readonly packagedExecutableDirectory: string | undefined;
  readonly portableExecutableDirectory: string | undefined;
  readonly projectRoot: string;
}): AppPaths {
  if (!input.isPackaged) {
    return resolveAppPaths({ mode: "development", projectRoot: input.projectRoot });
  }
  const executableDirectory =
    input.portableExecutableDirectory ?? input.packagedExecutableDirectory;
  if (executableDirectory === undefined) {
    throw new Error("A packaged executable directory is required for packaged startup");
  }
  return resolveAppPaths({
    mode: "portable",
    executableDirectory,
  });
}

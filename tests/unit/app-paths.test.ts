import { describe, expect, it } from "vitest";
import { resolveAppPaths, resolveRuntimeAppPaths } from "../../src/main/app-paths";

describe("application paths", () => {
  it("places portable data beside the user-visible executable", () => {
    const paths = resolveAppPaths({ mode: "portable", executableDirectory: "C:\\Tools" });

    expect(paths.dataRoot).toBe("C:\\Tools\\data");
    expect(paths.libraryRoot).toBe("C:\\Tools\\patch-categories");
  });

  it("uses the electron-builder portable directory instead of the extraction directory", () => {
    expect(
      resolveRuntimeAppPaths({
        isPackaged: true,
        packagedExecutableDirectory: "D:\\Applications\\DNF Patch Manager",
        portableExecutableDirectory: "D:\\应用\\DNF补丁管理器",
        projectRoot: "C:\\Temp\\portable-extract",
      }),
    ).toEqual({
      dataRoot: "D:\\应用\\DNF补丁管理器\\data",
      libraryRoot: "D:\\应用\\DNF补丁管理器\\patch-categories",
    });
  });

  it("uses the installed executable directory when the portable variable is absent", () => {
    expect(
      resolveRuntimeAppPaths({
        isPackaged: true,
        packagedExecutableDirectory: "E:\\Applications\\DNF Patch Manager",
        portableExecutableDirectory: undefined,
        projectRoot: "C:\\Temp\\installed-app",
      }),
    ).toEqual({
      dataRoot: "E:\\Applications\\DNF Patch Manager\\data",
      libraryRoot: "E:\\Applications\\DNF Patch Manager\\patch-categories",
    });
  });

  it("fails packaged startup without an executable directory", () => {
    expect(() =>
      resolveRuntimeAppPaths({
        isPackaged: true,
        packagedExecutableDirectory: undefined,
        portableExecutableDirectory: undefined,
        projectRoot: "C:\\Temp\\portable-extract",
      }),
    ).toThrow("packaged executable directory is required");
  });

  it("keeps development data inside the project", () => {
    const paths = resolveAppPaths({
      mode: "development",
      projectRoot: "C:\\workspace\\dnf-rewrite",
    });

    expect(paths.dataRoot).toBe("C:\\workspace\\dnf-rewrite\\data");
    expect(paths.libraryRoot).toBe("C:\\workspace\\dnf-rewrite\\patch-categories");
  });
});

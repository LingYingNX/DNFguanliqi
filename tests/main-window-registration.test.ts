import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appListeners: new Map<string, () => void>(),
  registerIpc: vi.fn(async (..._args: unknown[]) => undefined),
  requestSingleInstanceLock: vi.fn(() => true),
  setPath: vi.fn(),
  windows: [] as unknown[],
}));

vi.mock("electron", () => {
  class FakeBrowserWindow {
    static getAllWindows(): readonly unknown[] {
      return mocks.windows;
    }

    readonly webContents = {};

    constructor() {
      mocks.windows.push(this);
    }

    getBounds() {
      return { height: 900, width: 1440, x: 0, y: 0 };
    }

    loadFile(): Promise<void> {
      return Promise.resolve();
    }

    loadURL(): Promise<void> {
      return Promise.resolve();
    }

    once(): void {}

    setPosition(): void {}

    show(): void {}

    isMinimized(): boolean {
      return false;
    }

    restore(): void {}

    focus(): void {}
  }

  return {
    BrowserWindow: FakeBrowserWindow,
    Menu: { setApplicationMenu: vi.fn() },
    app: {
      isPackaged: false,
      on: vi.fn((event: string, listener: () => void) => {
        mocks.appListeners.set(event, listener);
      }),
      quit: vi.fn(),
      requestSingleInstanceLock: mocks.requestSingleInstanceLock,
      setPath: mocks.setPath,
      whenReady: vi.fn(() => Promise.resolve()),
    },
    screen: { getAllDisplays: () => [{ workArea: { height: 1080, width: 1920, x: 0, y: 0 } }] },
  };
});

vi.mock("../src/main/app-paths", () => ({
  resolveRuntimeAppPaths: () => ({ dataRoot: "data", libraryRoot: "library" }),
}));
vi.mock("../src/main/ipc/register-ipc", () => ({ registerIpc: mocks.registerIpc }));
vi.mock("../src/main/managed-asset-protocol", () => ({
  registerLibraryPreviewProtocol: vi.fn(),
  registerManagedAssetProtocol: vi.fn(),
}));
vi.mock("../src/main/window-placement", () => ({
  recoverWindowPosition: () => ({ x: 0, y: 0 }),
}));

describe("main window registration", () => {
  afterEach(() => {
    mocks.appListeners.clear();
    mocks.registerIpc.mockClear();
    mocks.requestSingleInstanceLock.mockClear();
    mocks.setPath.mockClear();
    mocks.windows.length = 0;
    vi.resetModules();
  });

  it("registers IPC for a window reopened after application activation", async () => {
    await import("../src/main/main");
    await vi.waitFor(() => expect(mocks.registerIpc).toHaveBeenCalledTimes(1));

    const activate = mocks.appListeners.get("activate");
    expect(activate).toBeDefined();
    mocks.windows.length = 0;
    activate?.();

    await vi.waitFor(() => expect(mocks.registerIpc).toHaveBeenCalledTimes(2));
    expect(mocks.registerIpc.mock.calls[1]?.[0]).toBe(mocks.windows[0]);
  });

  it("stores Electron runtime data beside the application data", async () => {
    await import("../src/main/main");

    await vi.waitFor(() => expect(mocks.setPath).toHaveBeenCalledTimes(2));
    expect(mocks.setPath).toHaveBeenNthCalledWith(1, "userData", "data\\electron");
    expect(mocks.setPath).toHaveBeenNthCalledWith(2, "sessionData", "data\\electron\\session");
  });

  it("requests a single-instance lock before opening the window", async () => {
    await import("../src/main/main");

    expect(mocks.requestSingleInstanceLock).toHaveBeenCalledTimes(1);
  });
});

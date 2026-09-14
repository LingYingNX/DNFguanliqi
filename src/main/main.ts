import { dirname, join } from "node:path";
import { app, BrowserWindow, Menu, screen } from "electron";
import { resolveRuntimeAppPaths } from "./app-paths";
import { registerIpc } from "./ipc/register-ipc";
import {
  registerLibraryPreviewProtocol,
  registerManagedAssetProtocol,
} from "./managed-asset-protocol";
import { recoverWindowPosition } from "./window-placement";

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 720,
    frame: false,
    title: "",
    autoHideMenuBar: true,
    backgroundColor: "#0A0B0F",
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const position = recoverWindowPosition(
    window.getBounds(),
    screen.getAllDisplays().map((display) => display.workArea),
  );
  window.setPosition(position.x, position.y);

  window.once("ready-to-show", () => {
    window.show();
  });

  return window;
}

function loadRenderer(window: BrowserWindow): void {
  const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
  if (rendererUrl === undefined) {
    void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  } else {
    void window.loadURL(rendererUrl);
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window === undefined) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  void app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    const paths = resolveRuntimeAppPaths({
      isPackaged: app.isPackaged,
      packagedExecutableDirectory: app.isPackaged ? dirname(process.execPath) : undefined,
      portableExecutableDirectory: process.env["PORTABLE_EXECUTABLE_DIR"],
      projectRoot: process.cwd(),
    });
    const electronDataRoot = join(paths.dataRoot, "electron");
    app.setPath("userData", electronDataRoot);
    app.setPath("sessionData", join(electronDataRoot, "session"));
    registerManagedAssetProtocol(paths);
    registerLibraryPreviewProtocol(paths);

    const openWindow = async (): Promise<void> => {
      const nextWindow = createWindow();
      await registerIpc(nextWindow, paths, app.isPackaged);
      loadRenderer(nextWindow);
    };

    await openWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void openWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

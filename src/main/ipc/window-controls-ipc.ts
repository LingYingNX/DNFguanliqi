import { type BrowserWindow, ipcMain } from "electron";
import type { ApiResult, WindowState } from "../../shared/ipc-contracts";
import { IPC_CHANNELS } from "../../shared/ipc-contracts";

const ok = <T>(value: T): ApiResult<T> => ({ ok: true, value });

export function registerWindowControlsIpc(window: BrowserWindow): void {
  const currentState = (): WindowState => ({ isMaximized: window.isMaximized() });
  const publishState = (): void => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.windowStateChanged, currentState());
    }
  };
  const handleStateChange = (): void => publishState();

  window.on("maximize", handleStateChange);
  window.on("unmaximize", handleStateChange);
  window.on("restore", handleStateChange);

  ipcMain.removeHandler(IPC_CHANNELS.getWindowState);
  ipcMain.handle(IPC_CHANNELS.getWindowState, () => ok(currentState()));

  ipcMain.removeHandler(IPC_CHANNELS.minimizeWindow);
  ipcMain.handle(IPC_CHANNELS.minimizeWindow, () => {
    window.minimize();
    return ok(null);
  });

  ipcMain.removeHandler(IPC_CHANNELS.toggleMaximizeWindow);
  ipcMain.handle(IPC_CHANNELS.toggleMaximizeWindow, () => {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
    return ok(currentState());
  });

  ipcMain.removeHandler(IPC_CHANNELS.closeWindow);
  ipcMain.handle(IPC_CHANNELS.closeWindow, () => {
    window.close();
    return ok(null);
  });
}

import { type BrowserWindow, dialog, ipcMain } from "electron";
import type { AsyncMutex } from "../../core/concurrency/async-mutex";
import { copyLibraryPreview, libraryPreviewUrl } from "../../core/library/library-preview";
import type { PreviewService } from "../../core/previews/preview-service";
import { type ApiResult, IPC_CHANNELS } from "../../shared/ipc-contracts";
import { SelectItemPreviewRequestSchema } from "../../shared/preview-contracts";
import type { LibraryRoot } from "../app-paths";
import { apiError, toApiResult } from "./api-result";
import { createValidatedHandler } from "./validated-handler";

type PreviewIpcDependencies = {
  readonly mutationMutex: AsyncMutex;
  readonly previews: PreviewService;
  readonly window: BrowserWindow;
  readonly libraryRoot?: LibraryRoot;
};

export function registerPreviewIpc({
  mutationMutex,
  previews,
  window,
  libraryRoot,
}: PreviewIpcDependencies): void {
  ipcMain.removeHandler(IPC_CHANNELS.getPreviewState);
  ipcMain.handle(IPC_CHANNELS.getPreviewState, async () => {
    const result = await previews.listActive();
    return result.ok ? { ok: true, value: { items: result.value } } : toApiResult(result);
  });

  ipcMain.removeHandler(IPC_CHANNELS.selectItemPreview);
  const select = createValidatedHandler(
    SelectItemPreviewRequestSchema,
    async (request): Promise<ApiResult<{ readonly previewUrl: string | null }>> => {
      const selection = await dialog.showOpenDialog(window, {
        properties: ["openFile"],
        filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif"] }],
      });
      if (selection.canceled) return { ok: true, value: { previewUrl: null } };
      const sourcePath = selection.filePaths[0];
      if (sourcePath === undefined) return { ok: false, error: apiError("INVALID_INPUT") };
      return mutationMutex.runExclusive(async () => {
        if (request.kind === "patch" && libraryRoot !== undefined) {
          const copied = await copyLibraryPreview({
            kind: "patch",
            libraryRoot,
            relativePath: request.relativePath,
            sourcePath,
          });
          return copied.ok
            ? {
                ok: true,
                value: { previewUrl: libraryPreviewUrl(copied.value.previewRelativePath) },
              }
            : toApiResult(copied);
        }
        const copied = await previews.set({ ...request, sourcePath });
        return copied.ok
          ? { ok: true, value: { previewUrl: copied.value.previewUrl } }
          : toApiResult(copied);
      });
    },
  );
  ipcMain.handle(IPC_CHANNELS.selectItemPreview, (_event, input: unknown) => select(input));
}

import type { DnfApi } from "../shared/ipc-contracts";

declare global {
  interface Window {
    readonly dnf: DnfApi;
  }
}

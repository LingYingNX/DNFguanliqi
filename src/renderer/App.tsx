import type { DnfApi } from "../shared/ipc-contracts";
import { PrimitiveShowcase } from "./components/PrimitiveShowcase";
import { WorkspaceApp } from "./components/WorkspaceApp";
import "./styles/base.css";

type AppProps = {
  readonly api?: DnfApi;
};

export function App({ api }: AppProps): React.JSX.Element {
  if (new URLSearchParams(window.location.search).get("showcase") === "1") {
    return <PrimitiveShowcase />;
  }

  return <WorkspaceApp client={api ?? window.dnf} />;
}

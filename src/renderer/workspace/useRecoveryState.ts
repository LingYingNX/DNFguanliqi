import { useEffect, useState } from "react";
import type { DnfApi } from "../../shared/ipc-contracts";
import type { RecoveryStateDto } from "../../shared/recovery-contracts";

const HEALTHY: RecoveryStateDto = { readOnly: false, files: [] };

export function useRecoveryState(client: DnfApi | undefined): RecoveryStateDto {
  const [state, setState] = useState(HEALTHY);
  useEffect(() => {
    if (client === undefined) return;
    void client.getRecoveryState().then((result) => {
      if (result.ok) setState(result.value);
    });
  }, [client]);
  return state;
}

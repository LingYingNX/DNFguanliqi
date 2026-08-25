import type { ZodType } from "zod";
import { type ApiResult, INVALID_INPUT_ERROR } from "../../shared/ipc-contracts";

export function createValidatedHandler<T, U>(
  schema: ZodType<T>,
  action: (request: T) => Promise<ApiResult<U>>,
): (input: unknown) => Promise<ApiResult<U>> {
  return async (input: unknown): Promise<ApiResult<U>> => {
    const parsed = schema.safeParse(input);
    return parsed.success ? action(parsed.data) : { ok: false, error: INVALID_INPUT_ERROR };
  };
}

import { describe, expect, it } from "vitest";
import { toApiResult } from "../../src/main/ipc/api-result";

describe("IPC API result errors", () => {
  it("preserves concrete recovery and affected-file paths for user recovery", () => {
    const journalPath = "D:\\DNF补丁管理器\\data\\transaction-recovery\\failure.json";
    const result = toApiResult({
      ok: false,
      error: {
        code: "ROLLBACK_FAILED",
        journalPath,
        targetPath: "D:\\DNF\\ImagePacks2\\coat.npk",
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "ROLLBACK_FAILED",
        message: `文件回滚失败，请按恢复日志手工检查：D:\\DNF\\ImagePacks2\\coat.npk；${journalPath}`,
        files: ["D:\\DNF\\ImagePacks2\\coat.npk", journalPath],
      },
    });
  });
});

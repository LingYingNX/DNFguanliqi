import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * 回归测试：防止 scripts/check-path-helpers.mjs 静默失效。
 * 该脚本是「禁止重复造路径/状态辅助」规则的唯一强制手段，
 * 若其模式因代码演进失配，就必须在这里变红。
 */
const projectRoot = resolve(import.meta.dirname, "../..");
const checker = join(projectRoot, "scripts", "check-path-helpers.mjs");

let sandbox: string;

beforeAll(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "dnf-dupguard-"));
  // 复制出可写的 src/ 与 scripts/ 子树，避免动到真实工作区。
  await cp(join(projectRoot, "src"), join(sandbox, "src"), { recursive: true });
  await cp(join(projectRoot, "scripts"), join(sandbox, "scripts"), { recursive: true });
});

afterAll(async () => {
  await rm(sandbox, { force: true, recursive: true, maxRetries: 5, retryDelay: 200 });
});

function runChecker() {
  // 传入沙箱根目录：脚本默认按自身位置定位仓库，直接执行会扫到真实 src/。
  return spawnSync(process.execPath, [checker, sandbox], {
    cwd: sandbox,
    encoding: "utf8",
    shell: false,
  });
}

async function withInjectedSnippet(
  relativePath: string,
  snippet: string,
  body: () => void,
): Promise<void> {
  const target = join(sandbox, relativePath);
  const original = await readFile(target, "utf8");
  await writeFile(target, `${original}\n${snippet}\n`, "utf8");
  try {
    body();
  } finally {
    await writeFile(target, original, "utf8");
  }
}

describe("check-path-helpers guard", () => {
  it("passes on the current source tree", () => {
    const result = spawnSync(process.execPath, [checker, projectRoot], {
      cwd: projectRoot,
      encoding: "utf8",
      shell: false,
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("未发现重复辅助");
  });

  it.each([
    [
      "重复声明 pathKey()",
      "src/core/library/scanner.ts",
      "function pathKey(value: string): string {\n  return value;\n}",
      "重复声明 pathKey()",
    ],
    [
      "重复声明 isNpkPath()",
      "src/core/previews/preview-service.ts",
      'function isNpkPath(path: string): boolean {\n  return path.endsWith(".npk");\n}',
      "重复声明 isNpkPath()",
    ],
    [
      "内联 .npk 判断",
      "src/core/library/import-patches.ts",
      'const isNpk = win32.extname(name).toLocaleLowerCase() === ".npk";',
      "内联 .npk 判断",
    ],
    [
      "内联路径键表达式",
      "src/renderer/workspace/model.ts",
      'const key = value.replaceAll("/", "\\\\").toLocaleLowerCase();',
      "内联路径键表达式",
    ],
  ])("rejects %s", async (_label, relativePath, snippet, expectedMessage) => {
    await withInjectedSnippet(relativePath, snippet, () => {
      const result = runChecker();

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(expectedMessage);
    });
  });

  it.each([
    ["src/core/library/category-commands.ts"],
    ["src/core/library/category-style-service.ts"],
  ])("allows the intentional isPathWithin copy in %s", async (relativePath) => {
    const content = await readFile(join(sandbox, relativePath), "utf8");

    // 前提：该文件确实有本地 isPathWithin，否则此断言会失去意义。
    expect(content).toContain("function isPathWithin(");

    const result = runChecker();

    expect(result.status).toBe(0);
  });
});

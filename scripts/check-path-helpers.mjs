#!/usr/bin/env node
/**
 * 阻止再次引入重复的路径/状态辅助实现。
 * 规则与例外说明见 src/AGENTS.md「禁止重复造路径/状态辅助」。
 * 由 .githooks/pre-commit 与 .github/workflows/no-duplicate-helpers.yml 调用。
 *
 * 用法：node scripts/check-path-helpers.mjs [repoRoot]
 * 省略 repoRoot 时取脚本所在仓库根；显式传入便于在测试沙箱中验证。
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const projectRoot = resolve(process.argv[2] ?? join(import.meta.dirname, ".."));
const srcRoot = join(projectRoot, "src");

/** 每个共享辅助的唯一实现位置；在别处声明同名 function 视为复制。 */
const CANONICAL_FILES = {
  pathKey: ["src/shared/path-key.ts"],
  isPathWithinKey: ["src/shared/path-key.ts"],
  isNpkPath: ["src/core/paths/relative-path.ts"],
  normalizedPathKey: ["src/core/paths/relative-path.ts"],
  parentRelativePath: ["src/core/paths/relative-path.ts"],
  isNotFoundError: ["src/core/filesystem/path-exists.ts"],
  isSafeRelativePath: ["src/shared/relative-path-guard.ts"],
  readOrFallback: ["src/core/state/atomic-json-store.ts"],
  // 以下两个在 category-commands / category-style-service 各有一份，
  // 因其归一化方式不同（win32.normalize / 去掉 .\ 前缀）而有意保留。
  normalizeRelativePath: [
    "src/core/paths/relative-path.ts",
    "src/core/library/category-commands.ts",
  ],
  isPathWithin: [
    "src/shared/path-key.ts",
    "src/core/library/category-commands.ts",
    "src/core/library/category-style-service.ts",
  ],
};

/** 内联等价表达式：只允许出现在其唯一实现文件中。 */
const INLINE_PATTERNS = [
  {
    name: "内联 .npk 判断",
    pattern: /win32\.extname\([^)]*\)\.toLocaleLowerCase\(\)\s*[!=]==\s*"\.npk"/u,
    allowed: ["src/core/paths/relative-path.ts"],
    hint: "改用 isNpkPath()",
  },
  {
    name: "内联路径键表达式",
    pattern: /\.replaceAll\("\/",\s*"\\\\"\)\.toLocaleLowerCase\(\)/u,
    allowed: ["src/shared/path-key.ts"],
    hint: "改用 pathKey()",
  },
  {
    name: "内联 win32.normalize 身份",
    pattern: /win32\.normalize\([^)]*\)\.toLocaleLowerCase\(\)/u,
    allowed: ["src/core/paths/relative-path.ts"],
    hint: "改用 normalizedPathKey()",
  },
  {
    name: "内联 ENOENT 判断",
    pattern:
      /typeof error === "object"\s*&&\s*error !== null\s*&&\s*"code" in error\s*&&\s*\(error as \{[^}]*\}\)\.code === "ENOENT"/u,
    allowed: ["src/core/filesystem/path-exists.ts"],
    hint: "改用 isNotFoundError()",
  },
];

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

async function sourceFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await sourceFiles(full)));
      continue;
    }
    if (!/\.tsx?$/u.test(entry.name)) continue;
    if (entry.name.includes(".test.")) continue;
    found.push(full);
  }
  return found;
}

function violationsIn(relPath, text) {
  const found = [];

  for (const [name, allowed] of Object.entries(CANONICAL_FILES)) {
    if (allowed.includes(relPath)) continue;
    const decl = new RegExp(
      `(?:^|\\n)[ \\t]*(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*[(<]`,
      "u",
    );
    const match = decl.exec(text);
    if (match !== null) {
      found.push({
        line: lineOf(text, match.index),
        message: `重复声明 ${name}()`,
        hint: `已有唯一实现：${allowed.join(" / ")}`,
      });
    }
  }

  for (const { name, pattern, allowed, hint } of INLINE_PATTERNS) {
    if (allowed.includes(relPath)) continue;
    const match = pattern.exec(text);
    if (match !== null) {
      found.push({ line: lineOf(text, match.index), message: name, hint });
    }
  }

  return found;
}

const files = await sourceFiles(srcRoot);
const reports = [];

for (const file of files) {
  const relPath = relative(projectRoot, file).replaceAll("\\", "/");
  const text = await readFile(file, "utf8");
  for (const violation of violationsIn(relPath, text)) {
    reports.push({ relPath, ...violation });
  }
}

if (reports.length === 0) {
  console.log(`check-path-helpers: ${files.length} 个源文件未发现重复辅助`);
  process.exit(0);
}

console.error("发现重复的路径/状态辅助实现（规则见 src/AGENTS.md）：\n");
for (const { relPath, line, message, hint } of reports) {
  console.error(`  ${relPath}:${line}  ${message}`);
  console.error(`      → ${hint}`);
}
console.error(`\n共 ${reports.length} 处。请改为 import 现有实现，勿新增副本。`);
process.exit(1);

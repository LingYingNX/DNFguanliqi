import { describe, expect, it } from "vitest";
import {
  isNpkPath,
  normalizedPathKey,
  normalizeRelativePath,
} from "../../src/core/paths/relative-path";

describe("isNpkPath", () => {
  it("accepts the .npk extension regardless of case", () => {
    expect(isNpkPath("coat.npk")).toBe(true);
    expect(isNpkPath("coat.NPK")).toBe(true);
    expect(isNpkPath("鬼剑士男\\coat.NpK")).toBe(true);
  });

  it("rejects other extensions and a bare name", () => {
    expect(isNpkPath("coat.npkx")).toBe(false);
    expect(isNpkPath("coat.png")).toBe(false);
    expect(isNpkPath("npk")).toBe(false);
    expect(isNpkPath("coat")).toBe(false);
  });
});

describe("normalizedPathKey", () => {
  it("collapses duplicate separators and dot segments", () => {
    expect(normalizedPathKey("A//B")).toBe("a\\b");
    expect(normalizedPathKey("./a/b")).toBe("a\\b");
    expect(normalizedPathKey("a/../b")).toBe("b");
  });

  it("lowercases and unifies separators", () => {
    expect(normalizedPathKey("A/B/C.NPK")).toBe("a\\b\\c.npk");
    expect(normalizedPathKey("鬼剑士男\\Coat.npk")).toBe("鬼剑士男\\coat.npk");
  });

  it("differs from pathKey on inputs a string key must not rewrite", () => {
    // Locks the reason core/paths/relative-path keeps a separate helper from
    // shared/path-key: this variant resolves `..`/`.` and duplicate separators,
    // so the two must not be merged.
    expect(normalizedPathKey("A//B")).not.toBe("a\\\\b");
    expect(normalizedPathKey("./a/b")).not.toBe(".\\a\\b");
  });
});

describe("normalizeRelativePath", () => {
  it("converts forward slashes and strips a leading .\\ prefix", () => {
    expect(normalizeRelativePath("./a/b")).toBe("a\\b");
    expect(normalizeRelativePath("a/b")).toBe("a\\b");
  });

  it("preserves case so callers decide whether to fold it", () => {
    expect(normalizeRelativePath("A/B")).toBe("A\\B");
    expect(normalizeRelativePath("A/B").toLocaleLowerCase()).toBe("a\\b");
  });

  it("leaves other path shapes untouched", () => {
    expect(normalizeRelativePath("a//b")).toBe("a\\\\b");
    expect(normalizeRelativePath("")).toBe("");
  });
});

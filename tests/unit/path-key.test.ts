import { describe, expect, it } from "vitest";
import { isPathWithin, isPathWithinKey, pathKey } from "../../src/shared/path-key";

describe("pathKey", () => {
  it("normalizes separators to backslash and lowercases", () => {
    expect(pathKey("A/B/c.npk")).toBe("a\\b\\c.npk");
    expect(pathKey("A\\B\\C.NPK")).toBe("a\\b\\c.npk");
  });

  it("keeps duplicate separators and dot segments untouched", () => {
    // Deliberate: pathKey is a string key, not a path resolver. See normalizedPathKey
    // in core/paths/relative-path for the variant that does collapse these.
    expect(pathKey("a//b")).toBe("a\\\\b");
    expect(pathKey("./a")).toBe(".\\a");
    expect(pathKey("a/../b")).toBe("a\\..\\b");
  });
});

describe("isPathWithinKey", () => {
  it("matches the path itself and its descendants", () => {
    expect(isPathWithinKey("a", "a")).toBe(true);
    expect(isPathWithinKey("a\\b", "a")).toBe(true);
    expect(isPathWithinKey("a\\b\\c", "a\\b")).toBe(true);
  });

  it("does not match a sibling sharing a name prefix", () => {
    expect(isPathWithinKey("ab", "a")).toBe(false);
    expect(isPathWithinKey("a\\bc", "a\\b")).toBe(false);
  });

  it("does not match a parent or an unrelated path", () => {
    expect(isPathWithinKey("a", "a\\b")).toBe(false);
    expect(isPathWithinKey("b\\a", "a")).toBe(false);
  });
});

describe("isPathWithin", () => {
  it("compares case-insensitively across separator styles", () => {
    expect(isPathWithin("A/B", "a")).toBe(true);
    expect(isPathWithin("a", "A")).toBe(true);
    expect(isPathWithin("分类A/Sub", "分类a")).toBe(true);
  });

  it("rejects paths outside the parent", () => {
    expect(isPathWithin("abc", "ab")).toBe(false);
    expect(isPathWithin("b/a", "a")).toBe(false);
  });
});

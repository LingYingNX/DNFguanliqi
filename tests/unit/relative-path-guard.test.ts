import { describe, expect, it } from "vitest";
import { isSafeRelativePath } from "../../src/shared/relative-path-guard";

describe("isSafeRelativePath", () => {
  it("accepts plain relative paths, including Chinese names", () => {
    expect(isSafeRelativePath("coat.npk")).toBe(true);
    expect(isSafeRelativePath("鬼剑士男/coat.npk")).toBe(true);
    expect(isSafeRelativePath("鬼剑士男\\coat.npk")).toBe(true);
    expect(isSafeRelativePath("a/b/c/d.npk")).toBe(true);
  });

  it("rejects drive-letter absolute paths", () => {
    expect(isSafeRelativePath("C:/coat.npk")).toBe(false);
    expect(isSafeRelativePath("C:\\coat.npk")).toBe(false);
    expect(isSafeRelativePath("d:/games/dnf")).toBe(false);
  });

  it("rejects rooted paths", () => {
    expect(isSafeRelativePath("/coat.npk")).toBe(false);
    expect(isSafeRelativePath("\\coat.npk")).toBe(false);
  });

  it("rejects traversal segments regardless of separator style", () => {
    expect(isSafeRelativePath("..")).toBe(false);
    expect(isSafeRelativePath("../coat.npk")).toBe(false);
    expect(isSafeRelativePath("..\\coat.npk")).toBe(false);
    expect(isSafeRelativePath("a/../b.npk")).toBe(false);
    expect(isSafeRelativePath("a\\..\\b.npk")).toBe(false);
  });

  it("does not treat a dotted name as traversal", () => {
    expect(isSafeRelativePath("...")).toBe(true);
    expect(isSafeRelativePath("a..b/coat.npk")).toBe(true);
    expect(isSafeRelativePath("..hidden/coat.npk")).toBe(true);
  });

  it("accepts the empty string, which callers tighten with their own min length", () => {
    // RelativePathSchema allows "" (the library root); ItemRelativePathSchema and
    // PresetRelativePathSchema add min(1) on top. The guard itself stays permissive.
    expect(isSafeRelativePath("")).toBe(true);
  });
});

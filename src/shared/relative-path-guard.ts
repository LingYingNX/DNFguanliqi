/** 拒绝绝对路径与 `..` 穿越的相对路径校验器（共享给各契约 schema 组合使用）。 */
export function isSafeRelativePath(value: string): boolean {
  if (/^[a-z]:[\\/]/iu.test(value) || value.startsWith("\\") || value.startsWith("/")) {
    return false;
  }
  return !value.replaceAll("\\", "/").split("/").includes("..");
}

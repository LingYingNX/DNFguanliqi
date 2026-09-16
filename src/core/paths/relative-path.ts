import { win32 } from "node:path";

/** 父级相对路径；顶层项（`win32.dirname` 返回 `.`）归一化为空串。 */
export function parentRelativePath(relativePath: string): string {
  const parent = win32.dirname(relativePath);
  return parent === "." ? "" : parent;
}

/** 大小写不敏感地判断路径是否以 `.npk` 结尾。 */
export function isNpkPath(path: string): boolean {
  return win32.extname(path).toLocaleLowerCase() === ".npk";
}

/**
 * 分隔符归一化为 `\` 并去掉开头的 `.\` 前缀。
 * 不做大小写转换，因此调用方需自行决定是否再 `toLocaleLowerCase`。
 */
export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replaceAll("/", "\\").replace(/^\.\\/u, "");
}

/**
 * 归一化后的路径标识，用于同一路径的比较与去重。
 * 与 `shared/path-key` 的 `pathKey` 不同：这里先做 `win32.normalize`，
 * 会折叠 `..`、`.`、重复分隔符，因此适用于已确认存在于磁盘的路径。
 */
export function normalizedPathKey(path: string): string {
  return win32.normalize(path).toLocaleLowerCase();
}

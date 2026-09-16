/**
 * 相对路径的大小写不敏感比较。仅做字符串归一化，不依赖 node:path，
 * 因此主进程与渲染进程可共用同一实现。
 */
export function pathKey(value: string): string {
  return value.replaceAll("/", "\\").toLocaleLowerCase();
}

/** 比较两个已归一化的路径键，判断 path 是否等于 parent 或位于其下。 */
export function isPathWithinKey(path: string, parent: string): boolean {
  return path === parent || path.startsWith(`${parent}\\`);
}

export function isPathWithin(relativePath: string, parentRelativePath: string): boolean {
  return isPathWithinKey(pathKey(relativePath), pathKey(parentRelativePath));
}

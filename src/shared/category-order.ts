export function isCategoryOrderForParent(
  parentRelativePath: string,
  orderedChildRelativePaths: readonly string[],
): boolean {
  const normalizedChildren = orderedChildRelativePaths.map((path) =>
    path.replaceAll("/", "\\").toLowerCase(),
  );
  if (new Set(normalizedChildren).size !== normalizedChildren.length) {
    return false;
  }
  const normalizedParent = parentRelativePath.replaceAll("/", "\\").toLowerCase();
  const prefix = normalizedParent === "" ? "" : `${normalizedParent}\\`;
  return normalizedChildren.every((normalizedPath) => {
    const remainder = normalizedPath.startsWith(prefix) ? normalizedPath.slice(prefix.length) : "";
    return remainder.length > 0 && !remainder.includes("\\");
  });
}

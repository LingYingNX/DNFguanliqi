import type { CategoryFolderStyle } from "../../shared/category-styles";
import { isPathWithinKey } from "../../shared/path-key";
import { ok, type Result } from "../../shared/result";
import { normalizeRelativePath } from "../paths/relative-path";
import {
  createAtomicJsonStore,
  readOrFallback,
  type StateStoreError,
} from "../state/atomic-json-store";
import { type CategoryStyleState, CategoryStyleStateSchema } from "../state/schemas";

export type CategoryStyleSnapshot = Pick<CategoryStyleState, "styles" | "colors" | "styleColors">;

export type CategoryStyleService = {
  readonly getAll: () => Promise<Result<CategoryStyleSnapshot, StateStoreError>>;
  readonly set: (
    relativePath: string,
    style?: CategoryFolderStyle,
    color?: string,
    colorStyle?: CategoryFolderStyle,
  ) => Promise<Result<CategoryStyleSnapshot, StateStoreError>>;
  readonly relocate: (
    sourceRelativePath: string,
    targetRelativePath: string,
  ) => Promise<Result<void, StateStoreError>>;
  readonly remove: (relativePath: string) => Promise<Result<void, StateStoreError>>;
};

function isPathWithin(relativePath: string, parentRelativePath: string): boolean {
  return isPathWithinKey(
    normalizeRelativePath(relativePath).toLocaleLowerCase(),
    normalizeRelativePath(parentRelativePath).toLocaleLowerCase(),
  );
}

function relocateRelativePath(
  relativePath: string,
  sourceRelativePath: string,
  targetRelativePath: string,
): string {
  const path = normalizeRelativePath(relativePath);
  const source = normalizeRelativePath(sourceRelativePath);
  return path.toLocaleLowerCase() === source.toLocaleLowerCase()
    ? normalizeRelativePath(targetRelativePath)
    : `${normalizeRelativePath(targetRelativePath)}${path.slice(source.length)}`;
}

function relocateEntries<T>(
  entries: Readonly<Record<string, T>>,
  sourceRelativePath: string,
  targetRelativePath: string,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(entries).map(([relativePath, value]) => [
      isPathWithin(relativePath, sourceRelativePath)
        ? relocateRelativePath(relativePath, sourceRelativePath, targetRelativePath)
        : relativePath,
      value,
    ]),
  );
}

export function createCategoryStyleService(file: string): CategoryStyleService {
  const store = createAtomicJsonStore(file, CategoryStyleStateSchema);

  const read = (): Promise<Result<CategoryStyleState, StateStoreError>> =>
    readOrFallback(store, () => ({ formatVersion: 1, styles: {}, colors: {}, styleColors: {} }));

  return {
    async getAll() {
      const result = await read();
      return result.ok
        ? ok({
            styles: result.value.styles,
            colors: result.value.colors,
            styleColors: result.value.styleColors,
          })
        : result;
    },
    async set(relativePath, style, color, colorStyle) {
      const result = await read();
      if (!result.ok) return result;
      const { styles, colors, styleColors } = result.value;

      // 调色板编辑只更新 styleColors，不改动该分类自身的样式与颜色。
      if (colorStyle !== undefined && color !== undefined) {
        const nextStyleColors = { ...styleColors, [colorStyle]: color };
        const written = await store.write({
          formatVersion: 1,
          styles,
          colors,
          styleColors: nextStyleColors,
        });
        return written.ok ? ok({ styles, colors, styleColors: nextStyleColors }) : written;
      }

      const normalized = normalizeRelativePath(relativePath);
      const nextStyles = style === undefined ? styles : { ...styles, [normalized]: style };
      const nextColors =
        color === undefined || style === undefined ? colors : { ...colors, [normalized]: color };
      const written = await store.write({
        formatVersion: 1,
        styles: nextStyles,
        colors: nextColors,
        styleColors,
      });
      return written.ok ? ok({ styles: nextStyles, colors: nextColors, styleColors }) : written;
    },
    async relocate(sourceRelativePath, targetRelativePath) {
      const result = await read();
      if (!result.ok) return result;
      return store.write({
        formatVersion: 1,
        styles: relocateEntries(result.value.styles, sourceRelativePath, targetRelativePath),
        colors: relocateEntries(result.value.colors, sourceRelativePath, targetRelativePath),
        styleColors: result.value.styleColors,
      });
    },
    async remove(relativePath) {
      const result = await read();
      if (!result.ok) return result;
      const withoutSubtree = <T>(entries: Readonly<Record<string, T>>): Record<string, T> =>
        Object.fromEntries(
          Object.entries(entries).filter(([path]) => !isPathWithin(path, relativePath)),
        );
      return store.write({
        formatVersion: 1,
        styles: withoutSubtree(result.value.styles),
        colors: withoutSubtree(result.value.colors),
        styleColors: result.value.styleColors,
      });
    },
  };
}

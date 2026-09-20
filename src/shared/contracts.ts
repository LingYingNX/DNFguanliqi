export const APP_NAME = "DNF 补丁管理器";
export const APP_VERSION = "1.2.6";
export const APP_RELEASE_NOTES = [
  "修复重命名失效",
  "修复补丁卡片右键菜单朝下",
  "修复文件夹导航线UI偏移错位",
  "更改一些视觉效果",
] as const;

export type AppInfo = {
  readonly name: typeof APP_NAME;
  readonly version: typeof APP_VERSION;
};

export const APP_NAME = "DNF 补丁管理器";
export const APP_VERSION = "1.2.4";
export const APP_RELEASE_NOTES = [
  "精简代码",
  "修复导航栏文件夹大小不统一",
  "修复补丁开关按钮闪烁",
  "新增打开软件自动检测更新的提示",
  "新增文件夹右键菜单功能，可以自定义文件夹菜单样式外观",
  "新增音效补丁安装（路径选择游戏根目录自动检测）",
] as const;

export type AppInfo = {
  readonly name: typeof APP_NAME;
  readonly version: typeof APP_VERSION;
};

export const APP_NAME = "DNF 补丁管理器";
export const APP_VERSION = "1.2.5";
export const APP_RELEASE_NOTES = [
  "修复自动更新或卸载会清空补丁库与设置文件的严重问题。",
  "补丁库与配置保留在安装目录内，升级、卸载不再删除。",
  "从旧版本升级前请先备份安装目录中的 patch-categories 与 data 文件夹。",
] as const;

export type AppInfo = {
  readonly name: typeof APP_NAME;
  readonly version: typeof APP_VERSION;
};

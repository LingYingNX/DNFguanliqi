export const APP_NAME = "DNF 补丁管理器";
export const APP_VERSION = "1.2.3";
export const APP_RELEASE_NOTES = ["新增项目地址与QQ群交流入口，优化软件更新提示。"] as const;

export type AppInfo = {
  readonly name: typeof APP_NAME;
  readonly version: typeof APP_VERSION;
};

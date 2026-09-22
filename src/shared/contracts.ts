export const APP_NAME = "DNF 补丁管理器";
export const APP_VERSION = "1.2.7";
export const APP_RELEASE_NOTES = [
  "增加选中多个补丁后可以对其批量开启。",
  "优化软件动效设计。",
] as const;

export type AppInfo = {
  readonly name: typeof APP_NAME;
  readonly version: typeof APP_VERSION;
};

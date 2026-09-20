export const APP_NAME = "DNF 补丁管理器";
export const APP_VERSION = "1.2.6";
export const APP_RELEASE_NOTES = [
  "修复文件夹重命名后改动被丢弃的问题：改完名字点击别处现在会正常保存。",
  "文件夹右键菜单新增重命名入口，并支持 F2 快捷重命名。",
  "文件夹行悬停显示浅蓝线框、选中显示加粗紫色线框，不再整行填充高亮。",
  "重命名时自动全选原名称，直接输入即可替换。",
] as const;

export type AppInfo = {
  readonly name: typeof APP_NAME;
  readonly version: typeof APP_VERSION;
};

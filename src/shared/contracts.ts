export const APP_NAME = "DNF 补丁管理器";
export const APP_VERSION = "1.2.6";
export const APP_RELEASE_NOTES = [
  "修复文件夹重命名后改动被丢弃的问题：改完名字点击别处现在会正常保存。",
  "修复重命名或新建文件夹后位置乱跳的问题：现在会保持原有排列，新文件夹追加在末尾。",
  "文件夹右键菜单新增重命名入口，并支持 F2 快捷重命名。",
  "补丁卡片右键菜单贴到窗口下缘时改为向上展开，滚动时自动关闭，不再被裁掉。",
  "设置页「关于软件」新增软件反馈入口，可直达反馈表格。",
  "文件夹行悬停显示浅蓝线框、选中显示加粗紫色线框，不再整行填充高亮。",
  "重命名时自动全选原名称，直接输入即可替换。",
] as const;

export type AppInfo = {
  readonly name: typeof APP_NAME;
  readonly version: typeof APP_VERSION;
};

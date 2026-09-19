; 安装目录内的用户数据（补丁库 patch-categories 与配置 data）必须始终保留。
; 通过 electron-builder 的 NSIS 扩展点挂载（package.json build.nsis.include）：
; - customInit：应用内更新时清除旧版卸载器的注册表登记，使更新跳过“先卸载旧版”
;   步骤，直接覆盖安装——同名文件替换、新增文件加入、其余一律不动，用户数据
;   天然保留（≤1.2.4 的旧卸载器没有白名单、会整目录清空，因此绝不能让它运行）。
; - customRemoveFiles：手动卸载时只删应用文件，按白名单保留用户数据。

!macro customInit
  DeleteRegValue SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
  DeleteRegValue SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "QuietUninstallString"
!macroend

!macro customRemoveFiles
  SetOutPath $TEMP
  DetailPrint "保留用户数据：$INSTDIR\patch-categories 与 $INSTDIR\data"
  Push $R0
  Push $R1
  FindFirst $R0 $R1 "$INSTDIR\*.*"
dnf_keep_loop:
  StrCmp $R1 "" dnf_keep_done
  StrCmp $R1 "." dnf_keep_next
  StrCmp $R1 ".." dnf_keep_next
  StrCmp $R1 "patch-categories" dnf_keep_next
  StrCmp $R1 "data" dnf_keep_next
  IfFileExists "$INSTDIR\$R1\*.*" 0 dnf_keep_file
    RMDir /r "$INSTDIR\$R1"
    Goto dnf_keep_next
dnf_keep_file:
  Delete "$INSTDIR\$R1"
dnf_keep_next:
  FindNext $R0 $R1
  Goto dnf_keep_loop
dnf_keep_done:
  FindClose $R0
  Pop $R1
  Pop $R0
  ; 目录里剩有用户数据时 RMDir 不生效，正好保留。
  RMDir "$INSTDIR"
!macroend

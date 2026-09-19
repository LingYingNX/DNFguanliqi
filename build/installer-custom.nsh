; 安装目录内的用户数据（补丁库 patch-categories 与配置 data）在更新和卸载时必须保留。
; 通过 electron-builder 的 NSIS 扩展点挂载（package.json build.nsis.include）：
; - customRemoveFiles：取代卸载器默认的“整目录清空”，只删应用文件。
; - customInit：更新安装时旧版（≤1.2.4）卸载器仍会整目录清空，先把用户数据抢搬到临时目录。
; - customInstall：新文件装好后把用户数据搬回安装目录。

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
  ; 只删应用文件；安装目录里剩有用户数据时 RMDir 不生效，正好保留。
  RMDir "$INSTDIR"
!macroend

!macro customInit
  RMDir /r "$TEMP\dnf-patch-manager-keep"
  ${if} ${FileExists} "$INSTDIR\patch-categories"
  ${orIf} ${FileExists} "$INSTDIR\data"
    CreateDirectory "$TEMP\dnf-patch-manager-keep"
    ${if} ${FileExists} "$INSTDIR\patch-categories"
      CopyFiles /SILENT "$INSTDIR\patch-categories" "$TEMP\dnf-patch-manager-keep" 2147483647
    ${endif}
    ${if} ${FileExists} "$INSTDIR\data"
      CopyFiles /SILENT "$INSTDIR\data" "$TEMP\dnf-patch-manager-keep" 2147483647
    ${endif}
  ${endif}
!macroend

!macro customInstall
  ${if} ${FileExists} "$TEMP\dnf-patch-manager-keep\patch-categories"
    CopyFiles /SILENT "$TEMP\dnf-patch-manager-keep\patch-categories" "$INSTDIR" 2147483647
  ${endif}
  ${if} ${FileExists} "$TEMP\dnf-patch-manager-keep\data"
    CopyFiles /SILENT "$TEMP\dnf-patch-manager-keep\data" "$INSTDIR" 2147483647
  ${endif}
  RMDir /r "$TEMP\dnf-patch-manager-keep"
!macroend

; 安装目录内的用户数据（补丁库 patch-categories 与配置 data）在更新和卸载时必须保留。
; 通过 electron-builder 的 NSIS 扩展点挂载（package.json build.nsis.include）：
; - customRemoveFiles：取代卸载器默认的“整目录清空”，只删应用文件（白名单）。
; - customInit：无白名单标记时（旧版 ≤1.2.4 卸载器会整目录清空），先把用户数据抢搬到临时目录。
; - customInstall：新文件装好后把用户数据搬回，并写入白名单标记供下次更新跳过抢搬。

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
  ; 工牌机制：1.2.5+ 安装器的 customInstall 会写入 resources\keep-user-data.flag，
  ; 表示该版卸载器自带白名单（保留用户数据）。有工牌则跳过抢搬，避免每次更新
  ; 把整个补丁库复制到 %TEMP% 再搬回；无工牌（≤1.2.4 旧卸载器，无白名单）才抢搬。
  ${if} ${FileExists} "$INSTDIR\resources\keep-user-data.flag"
    DetailPrint "检测到白名单标记，跳过用户数据抢搬"
  ${else}
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
  ; 挂工牌：标记本版卸载器已带白名单，下次更新据此跳过抢搬。
  CreateDirectory "$INSTDIR\resources"
  FileOpen $R9 "$INSTDIR\resources\keep-user-data.flag" w
  FileWrite $R9 "This uninstaller preserves patch-categories and data (1.2.5+)."
  FileClose $R9
!macroend

; v0.10.0 and v0.10.1 shipped with the product name "NaeNae AMLL TTML Tool Fork", which Tauri
; registers under its own uninstall key, so this installer would leave that copy installed.
; Silently run its uninstaller first. App data is kept because the identifier never changed and
; Tauri only deletes app data when the user ticks the checkbox.
!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $R0 SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\NaeNae AMLL TTML Tool Fork" "InstallLocation"
  ${If} $R0 != ""
    ; InstallLocation is stored quoted.
    StrCpy $R1 $R0 1
    ${If} $R1 == '"'
      StrCpy $R0 $R0 "" 1
      StrCpy $R0 $R0 -1
    ${EndIf}
    ${If} ${FileExists} "$R0\uninstall.exe"
      ExecWait '"$R0\uninstall.exe" /S _?=$R0'
      Delete "$R0\uninstall.exe"
      RMDir "$R0"
    ${EndIf}
  ${EndIf}
!macroend

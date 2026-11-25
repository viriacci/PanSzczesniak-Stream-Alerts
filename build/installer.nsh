!include "nsDialogs.nsh"
!include "FileFunc.nsh"

!ifndef BUILD_UNINSTALLER
Var pssaDesktop
Var pssaStartMenu
Var pssaDesktopBox
Var pssaStartMenuBox
Var pssaInstalledDir
Var pssaUninstaller
Var pssaUninstallArgs
Var pssaOptionsDialog

!macro customInit
  StrCpy $pssaDesktop "1"
  StrCpy $pssaStartMenu "1"
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/PSSA-NODESKTOP" $R1
  ${IfNot} ${Errors}
    StrCpy $pssaDesktop "0"
  ${EndIf}
  ClearErrors
  ${GetOptions} $R0 "/PSSA-NOSTART" $R1
  ${IfNot} ${Errors}
    StrCpy $pssaStartMenu "0"
  ${EndIf}
  ClearErrors
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Witaj w PSSA"
  !define MUI_WELCOMEPAGE_TEXT "Pan Szczesniak Stream Alerts$\r$\n$\r$\nTwoje centrum alertów i statystyk Twitch.$\r$\n$\r$\nKreator pozwoli zainstalować, zaktualizować lub odinstalować PSSA.$\r$\n$\r$\nTwoje dane i konfiguracja pozostaną zachowane."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customPageAfterChangeDir
  Page custom PssaOptionsShow PssaOptionsLeave

Function PssaOptionsShow
  !insertmacro MUI_HEADER_TEXT "Dostosuj PSSA" "Wybierz skróty i zarządzaj instalacją."
  nsDialogs::Create 1018
  Pop $pssaOptionsDialog
  StrCmp $pssaOptionsDialog "error" 0 +2
    Abort
  ${NSD_CreateLabel} 0u 0u 100% 18u "Skróty aplikacji"
  Pop $0
  ${NSD_CreateCheckbox} 0u 21u 100% 14u "Utwórz skrót na pulpicie"
  Pop $pssaDesktopBox
  ${NSD_SetState} $pssaDesktopBox $pssaDesktop
  ${NSD_CreateCheckbox} 0u 41u 100% 14u "Utwórz skrót w menu Start"
  Pop $pssaStartMenuBox
  ${NSD_SetState} $pssaStartMenuBox $pssaStartMenu

  ReadRegStr $pssaInstalledDir SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation"
  StrCpy $pssaUninstaller ""
  StrCpy $pssaUninstallArgs "/currentuser"
  ${If} $installMode == "all"
    StrCpy $pssaUninstallArgs "/allusers"
  ${EndIf}
  ${If} $pssaInstalledDir != ""
    ${If} ${FileExists} "$pssaInstalledDir\Uninstall PSSA.exe"
      StrCpy $pssaUninstaller "$pssaInstalledDir\Uninstall PSSA.exe"
    ${ElseIf} ${FileExists} "$pssaInstalledDir\Uninstall PSSA 2 Dev.exe"
      StrCpy $pssaUninstaller "$pssaInstalledDir\Uninstall PSSA 2 Dev.exe"
    ${EndIf}
  ${EndIf}
  ${If} $pssaUninstaller != ""
    ${NSD_CreateLabel} 0u 67u 100% 28u "Wykryto zainstalowaną wersję PSSA. Kontynuuj, aby ją zaktualizować, lub wybierz dezinstalację."
    Pop $0
    ${NSD_CreateButton} 0u 99u 100% 18u "Odinstaluj PSSA..."
    Pop $0
    ${NSD_OnClick} $0 PssaRemove
    ${NSD_CreateLabel} 0u 121u 100% 20u "Dezinstalacja zachowuje konfigurację i historię."
    Pop $0
  ${Else}
    ${NSD_CreateLabel} 0u 75u 100% 25u "PSSA jest gotowe do instalacji. Kliknij Dalej, aby kontynuować."
    Pop $0
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function PssaOptionsLeave
  ${NSD_GetState} $pssaDesktopBox $pssaDesktop
  ${NSD_GetState} $pssaStartMenuBox $pssaStartMenu
FunctionEnd

Function PssaRemove
  Pop $0
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Uruchomić dezinstalację PSSA?$\r$\nKonfiguracja, multimedia i historia pozostaną na dysku." IDNO pssaRemoveCancel
  ClearErrors
  ExecShell "open" "$pssaUninstaller" "$pssaUninstallArgs"
  IfErrors pssaRemoveError
  Quit
  pssaRemoveError:
    MessageBox MB_OK|MB_ICONSTOP "Nie udało się uruchomić dezinstalatora."
  pssaRemoveCancel:
FunctionEnd
!macroend

!macro customInstall
  # Electron-builder creates its normal links first; explicit choices take precedence.
  ${If} $pssaDesktop == "1"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  ${Else}
    Delete "$newDesktopLink"
  ${EndIf}
  ${If} $pssaStartMenu == "1"
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${Else}
    Delete "$newStartMenuLink"
  ${EndIf}
  # Retire only shortcuts belonging to the old PSSA product name.
  Delete "$DESKTOP\PSSA 2 Dev.lnk"
  Delete "$SMPROGRAMS\PSSA 2 Dev.lnk"
!macroend
!endif

; ============================================================================
;  Instalator "Nagrody Shiroe" (Twitch Reward Alerts) - Inno Setup 6.x
;
;  Umiesc ten plik w folderze projektu (obok "dist\", main.py, icon.ico) i
;  otworz go w Inno Setup Compiler, potem Build -> Compile (albo Ctrl+F9).
; ============================================================================

#define MyAppName "Nagrody Shiroe"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "PanSzczesniak"
#define MyAppExeName "Nagrody Shiroe.exe"
; Folder, ktory wyszedl z PyInstallera (build_exe.bat / "Nagrody Shiroe.spec")
#define MyBuildDir "dist\Nagrody Shiroe"

[Setup]
; Ten GUID identyfikuje TEN konkretny program dla Windows (Panel sterowania,
; aktualizacje). Zostaw go bez zmian miedzy kolejnymi wersjami - dzieki temu
; instalator nowszej wersji poprawnie nadpisze/zaktualizuje stara, zamiast
; zainstalowac program drugi raz obok. Jesli kiedys zrobisz calkiem INNY
; program, wygeneruj nowy: Inno Setup -> Tools -> Generate GUID.
AppId={{A7E3D9F2-4B6C-4A1E-9D3F-8C2B5E7A9F10}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableDirPage=yes
DisableProgramGroupPage=yes
; lowest = instalacja tylko dla biezacego uzytkownika, BEZ okienka UAC i BEZ
; potrzeby bycia administratorem - najlepsze gdy wysylasz komus gotowy .exe
PrivilegesRequired=lowest
OutputDir=installer_output
OutputBaseFilename=Nagrody-Shiroe-Instalator
Compression=lzma2
SolidCompression=yes
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"

[Tasks]
Name: "desktopicon"; Description: "Utworz skrot na Pulpicie"; GroupDescription: "Dodatkowe skroty:"

[Files]
; Cala zawartosc "dist\Nagrody Shiroe" (exe + folder _internal) trafia do {app}
Source: "{#MyBuildDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Odinstaluj {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Uruchom {#MyAppName} teraz"; Flags: nowait postinstall skipifsilent

; Uwaga: CELOWO nie kasujemy przy odinstalowaniu folderu z danymi
; (Dokumenty\Shiroe Twitch Alerts - config.json, media\, autoryzacja Twitcha).
; Dzieki temu aktualizacja programu (odinstaluj stara wersje -> zainstaluj
; nowa) NIE kasuje przypisanych GIF-ow/dzwiekow ani zalogowania.

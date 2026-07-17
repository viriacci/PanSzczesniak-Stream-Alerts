; ============================================================================
;  Instalator "PanSzczesniak Stream Alerts" - Inno Setup 6.x
;
;  Umiesc ten plik w folderze projektu (obok "dist\", main.py, icon.ico) i
;  otworz go w Inno Setup Compiler, potem Build -> Compile (albo Ctrl+F9).
; ============================================================================

#define MyAppName "PanSzczesniak Stream Alerts"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "PanSzczesniak"
#define MyAppExeName "PanSzczesniak Stream Alerts.exe"
; Folder, ktory wyszedl z PyInstallera (build_exe.bat / "PanSzczesniak Stream Alerts.spec")
#define MyBuildDir "dist\PanSzczesniak Stream Alerts"

[Setup]
; UWAGA: to NOWY GUID, inny niz w instalatorze dla Shiroe/Vivi - to celowe.
; Kazdy odrebny produkt/branding powinien miec wlasny AppId, zeby Windows nie
; probowal "aktualizowac" jednego programu w drugi. Zostaw go bez zmian
; miedzy kolejnymi wersjami TEGO produktu - dzieki temu instalator nowszej
; wersji poprawnie nadpisze/zaktualizuje stara. Nowy produkt = nowy GUID
; (Inno Setup -> Tools -> Generate GUID).
AppId={{F34B194A-B5CB-4FAD-81CC-3E1449668B16}
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
OutputBaseFilename=PanSzczesniak-Stream-Alerts-Instalator
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
; Cala zawartosc "dist\PanSzczesniak Stream Alerts" (exe + folder _internal) trafia do {app}
Source: "{#MyBuildDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Odinstaluj {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Uruchom {#MyAppName} teraz"; Flags: nowait postinstall skipifsilent

; Uwaga: CELOWO nie kasujemy przy odinstalowaniu folderu z danymi
; (Dokumenty\PanSzczesniak Stream Alerts - config.json, media\, autoryzacja
; Twitcha). Dzieki temu aktualizacja programu (odinstaluj stara wersje ->
; zainstaluj nowa) NIE kasuje przypisanych GIF-ow/dzwiekow ani zalogowania.

; ============================================================
;  AquaGuard 青羽守护 — Inno Setup 打包脚本
;  用法：
;    1. 先在项目根目录执行  npx electron-builder --win --dir
;       （生成 dist\win-unpacked\ 目录）
;    2. 用 Inno Setup 6 打开本文件，点 Build → Compile
;       或在命令行执行  ISCC.exe build\installer.iss
;    3. 产物：dist\AquaGuard-Setup-1.0.0.exe
; ============================================================

#define MyAppName "AquaGuard 青羽守护"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "AquaGuard Studio"
#define MyAppExeName "AquaGuard.exe"
#define MyAppId "{{7C4A9E20-9F2B-4C7D-8E31-5B6A0D3F1C88}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\AquaGuard
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=AquaGuard-Setup-{#MyAppVersion}
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
MinVersion=10.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务："; Flags: unchecked
Name: "startup"; Description: "开机自动启动 AquaGuard（推荐）"; GroupDescription: "附加任务："

[Files]
Source: "..\dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; \
    ValueName: "AquaGuard"; ValueData: """{app}\{#MyAppExeName}"" --hidden"; \
    Flags: uninsdeletevalue; Tasks: startup

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "立即启动 {#MyAppName}"; \
    Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\resources\app.asar.unpacked"

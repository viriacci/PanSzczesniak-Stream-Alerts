import {app,dialog,type BrowserWindow} from 'electron'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {join} from 'node:path'
import {existsSync} from 'node:fs'
import {dockLayout,obsVersion,parseCandidates,type ObsCandidate} from './dock-detection'
const exec=promisify(execFile)
const quoted=(s:string)=>"'"+s.replaceAll("'","''")+"'"
const powerShell=()=>join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe')
async function run(script:string,timeout=20000){
 return exec(powerShell(),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout,maxBuffer:1024*1024})
}
const discovery=String.raw`
$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$result=New-Object System.Collections.Generic.List[object]
$seen=@{}
function Add-OBS($path,$source,$version=''){
 if(!$path){return}
 $path=([Environment]::ExpandEnvironmentVariables([string]$path)).Trim().Trim('"')
 if(Test-Path -LiteralPath $path -PathType Container){$path=Join-Path $path 'bin\64bit\obs64.exe'}
 if(!(Test-Path -LiteralPath $path -PathType Leaf) -or [IO.Path]::GetFileName($path) -ine 'obs64.exe'){return}
 $path=(Get-Item -LiteralPath $path).FullName
 if($seen.ContainsKey($path)){if($version){$seen[$path].versions+=@([string]$version)};return}
 $v=(Get-Item -LiteralPath $path).VersionInfo
 $root=Split-Path (Split-Path (Split-Path $path))
 $portable=(Test-Path -LiteralPath (Join-Path $root 'portable_mode')) -or (Test-Path -LiteralPath (Join-Path $root 'portable_mode.txt'))
 $entry=[pscustomobject]@{path=$path;source=$source;versions=@([string]$v.FileVersion,[string]$v.ProductVersion,[string]$version,[string]$v.FileMajorPart,[string]$v.ProductMajorPart);portable=[bool]$portable}
 $seen[$path]=$entry;$result.Add($entry)
}
`
const automatic=String.raw`
foreach($p in @(Get-Process obs64 -ErrorAction SilentlyContinue)){Add-OBS $p.Path 'Uruchomiony OBS'}
foreach($key in @('HKLM:\SOFTWARE\OBS Studio','HKCU:\SOFTWARE\OBS Studio','HKLM:\SOFTWARE\WOW6432Node\OBS Studio')){
 $r=Get-ItemProperty -LiteralPath $key
 if($r){foreach($p in @($r.'(default)',$r.InstallLocation,$r.InstallPath)){Add-OBS $p 'Rejestr OBS' $r.Version}}
}
foreach($key in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*')){
 foreach($r in @(Get-ItemProperty $key | Where-Object {$_.DisplayName -match '^OBS Studio(?:\s|$)'})){
  Add-OBS $r.InstallLocation 'Rejestr instalacji' $r.DisplayVersion
  if($r.DisplayIcon -match '^\s*"?(.+?obs64\.exe)"?(?:,\d+)?$'){Add-OBS $Matches[1] 'Rejestr instalacji' $r.DisplayVersion}
  if($r.UninstallString -match '^\s*"?(.+?\.exe)"?(?:\s|$)'){Add-OBS (Split-Path $Matches[1]) 'Rejestr instalacji' $r.DisplayVersion}
 }
}
foreach($base in @($env:ProgramFiles,${env:ProgramFiles(x86)},$env:LOCALAPPDATA)){
 if($base){Add-OBS (Join-Path $base 'obs-studio') 'Katalog domyślny';Add-OBS (Join-Path $base 'Programs\obs-studio') 'Katalog domyślny'}
}
$steamRoots=@()
foreach($key in @('HKCU:\Software\Valve\Steam','HKLM:\SOFTWARE\WOW6432Node\Valve\Steam','HKLM:\SOFTWARE\Valve\Steam')){
 $r=Get-ItemProperty -LiteralPath $key
 $steamRoots+=@($r.SteamPath,$r.InstallPath)
}
if(${env:ProgramFiles(x86)}){$steamRoots+=Join-Path ${env:ProgramFiles(x86)} 'Steam'}
foreach($steam in @($steamRoots|Where-Object {$_}|Select-Object -Unique)){
 $libraries=@($steam)
 $vdf=Join-Path $steam 'steamapps\libraryfolders.vdf'
 if(Test-Path -LiteralPath $vdf){
  $raw=Get-Content -LiteralPath $vdf -Raw
  foreach($m in [regex]::Matches($raw,'(?im)^\s*"path"\s*"([^"]+)"')){$libraries+=$m.Groups[1].Value.Replace('\\','\')}
 }
 foreach($lib in @($libraries|Select-Object -Unique)){
  $apps=Join-Path $lib 'steamapps'
  $manifest=Join-Path $apps 'appmanifest_1905180.acf'
  if(Test-Path -LiteralPath $manifest){
   $raw=Get-Content -LiteralPath $manifest -Raw
   if($raw -match '(?im)^\s*"installdir"\s*"([^"]+)"'){Add-OBS (Join-Path (Join-Path $apps 'common') $Matches[1]) 'Steam'}
  }
  Add-OBS (Join-Path $apps 'common\OBS Studio') 'Steam'
 }
}
`
async function detect(manual?:string):Promise<ObsCandidate[]>{
 const {stdout}=await run(discovery+(manual?"\nAdd-OBS "+quoted(manual)+" 'Wybór ręczny'\n":automatic)+"\nConvertTo-Json -InputObject @($result.ToArray()) -Depth 4 -Compress")
 return parseCandidates(JSON.parse(stdout.trim()||'[]'))
}
let busy=false
export async function installObsDock(window:BrowserWindow):Promise<boolean>{
 if(busy||process.platform!=='win32'||!app.isPackaged)throw Error('Wtyczka dostępna w instalacji Windows x64.')
 busy=true
 try{
  const dll=join(process.resourcesPath,'obs-dock','pssa-control-dock.dll')
  if(!existsSync(dll))throw Error('Brak pliku wtyczki w instalacji PSSA.')
  let candidates:ObsCandidate[]=[]
  try{candidates=await detect()}catch{ /* Manual fallback when discovery is unavailable. */ }
  let chosen:ObsCandidate|undefined=candidates[0]
  if(candidates.length>1){
   const choices=candidates.slice(0,6)
   const r=await dialog.showMessageBox(window,{type:'question',title:'Wybierz instalację OBS',message:'Wykryto kilka instalacji OBS.',detail:choices.map((c,i)=>(i+1)+'. '+(obsVersion(c.versions)?.label??'Nieznana wersja')+' · '+c.source+'\n'+c.path).join('\n\n'),buttons:[...choices.map((_,i)=>'Instalacja '+(i+1)),'Wskaż inną','Anuluj'],defaultId:0,cancelId:choices.length+1})
   if(r.response===choices.length+1)return false
   chosen=choices[r.response]
  }
  if(!chosen){
   const r=await dialog.showOpenDialog(window,{title:'Nie wykryto OBS automatycznie. Wskaż obs64.exe.',properties:['openFile'],filters:[{name:'OBS Studio',extensions:['exe']}]})
   if(r.canceled||!r.filePaths[0])return false
   chosen=(await detect(r.filePaths[0]))[0]
   if(!chosen)throw Error('Nie znaleziono obs64.exe.')
  }
  if(chosen.portable)throw Error('Wykryto tryb portable OBS. Obecnie obsługiwane są standardowe instalacje Windows x64.')
  let version=obsVersion(chosen.versions)
  if(!version){
   const r=await dialog.showMessageBox(window,{type:'question',title:'Nie można odczytać wersji OBS',message:'Znaleziono OBS, ale jego plik EXE nie zawiera rozpoznawalnej wersji.',detail:chosen.path+'\nSprawdź wersję w OBS → Pomoc → Informacje. Wybierz właściwą grupę tylko wtedy, gdy znasz wersję.',buttons:['Anuluj','OBS 31–32','OBS 33'],defaultId:0,cancelId:0})
   if(r.response===0)return false
   version={major:r.response===2?33:31,label:r.response===2?'33 (wybór ręczny)':'31–32 (wybór ręczny)'}
  }
  const layout=dockLayout(version.major)
  const confirm=await dialog.showMessageBox(window,{type:'question',title:'Dodaj wtyczkę do OBS',message:'Zainstalować PSSA Control Dock?',detail:'OBS '+version.label+' · '+chosen.source+'\n'+chosen.path+'\n\nZamknij OBS przed instalacją. Windows poprosi o uprawnienia administratora. Wtyczka trafi do wspólnego katalogu ProgramData.',buttons:['Anuluj','Zainstaluj'],defaultId:0,cancelId:0})
  if(confirm.response!==1)return false
  const script=[
   "$ErrorActionPreference='Stop'",
   "if(Get-Process obs64 -ErrorAction SilentlyContinue){exit 12}",
   "$dll="+quoted(dll),"$modernLayout="+(layout==='modern'?'$true':'$false'),
   "$root=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'obs-studio\\plugins\\pssa-control-dock'",
   "$legacy=Join-Path $root 'bin\\64bit\\pssa-control-dock.dll'",
   "$modern=Join-Path $root 'pssa-control-dock.dll'",
   "if($modernLayout){$target=$modern;$old=$legacy}else{$target=$legacy;$old=$modern}",
   "New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null",
   "New-Item -ItemType Directory -Path (Join-Path $root 'data') -Force | Out-Null",
   "$license=Join-Path (Split-Path $dll) 'COPYING'; if(Test-Path -LiteralPath $license){Copy-Item -LiteralPath $license -Destination (Join-Path $root 'COPYING') -Force}",
   "Copy-Item -LiteralPath $dll -Destination $target -Force",
   "if((Get-FileHash -LiteralPath $dll).Hash -ne (Get-FileHash -LiteralPath $target).Hash){exit 14}",
   "if(Test-Path -LiteralPath $old){Remove-Item -LiteralPath $old -Force}",
   "exit 0"
  ].join('\r\n')
  const encoded=Buffer.from(script,'utf16le').toString('base64')
  const outer="$ErrorActionPreference='Stop'; $p=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList '-NoProfile -NonInteractive -EncodedCommand "+encoded+"' -Verb RunAs -Wait -PassThru; exit $p.ExitCode"
  try{await run(outer,120000)}
  catch(e){const code=(e as {code?:number}).code;throw Error(code===12?'Zamknij OBS i spróbuj ponownie.':code===14?'Weryfikacja pliku DLL nie powiodła się.':'Instalacja anulowana lub nie powiodła się.')}
  return true
 }finally{busy=false}
}

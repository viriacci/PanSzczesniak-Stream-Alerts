import {app,dialog,type BrowserWindow} from 'electron'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {join} from 'node:path'
import {existsSync} from 'node:fs'
const exec=promisify(execFile)
const quoted=(s:string)=>"'"+s.replaceAll("'","''")+"'"
let busy=false
export async function installObsDock(window:BrowserWindow):Promise<boolean>{
 if(busy||process.platform!=='win32'||!app.isPackaged)throw Error('Wtyczka dostępna w instalacji Windows x64.')
 busy=true
 try{
  const dll=join(process.resourcesPath,'obs-dock','pssa-control-dock.dll')
  if(!existsSync(dll))throw Error('Brak pliku wtyczki w instalacji PSSA.')
  let obs=join(process.env.ProgramFiles??'C:\\Program Files','obs-studio','bin','64bit','obs64.exe')
  if(!existsSync(obs)){const result=await dialog.showOpenDialog(window,{title:'Wskaż obs64.exe (standardowa instalacja OBS)',properties:['openFile'],filters:[{name:'OBS Studio',extensions:['exe']}]});if(result.canceled||!result.filePaths[0])return false;obs=result.filePaths[0]}
  if(!/[\\/]obs64\.exe$/i.test(obs))throw Error('Wybierz obs64.exe.')
  const confirm=await dialog.showMessageBox(window,{type:'question',title:'Dodaj wtyczkę do OBS',message:'Zainstalować PSSA Control Dock?',detail:'Zamknij OBS przed instalacją. Windows poprosi o uprawnienia administratora. Obsługiwane są standardowe instalacje OBS 31–33 x64; tryb portable nie jest obsługiwany.',buttons:['Anuluj','Zainstaluj'],defaultId:0,cancelId:0})
  if(confirm.response!==1)return false
  const script=[
   "$ErrorActionPreference='Stop'",
   "if(Get-Process obs64 -ErrorAction SilentlyContinue){exit 12}",
   "$dll="+quoted(dll),"$obs="+quoted(obs),
   "$v=(Get-Item -LiteralPath $obs).VersionInfo.ProductMajorPart",
   "if($v -lt 31 -or $v -gt 33){exit 13}",
   "$root=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'obs-studio\\plugins\\pssa-control-dock'",
   "$legacy=Join-Path $root 'bin\\64bit\\pssa-control-dock.dll'",
   "$modern=Join-Path $root 'pssa-control-dock.dll'",
   "if($v -ge 33){$target=$modern;$old=$legacy}else{$target=$legacy;$old=$modern}",
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
  try{await exec(join(process.env.SystemRoot??'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(outer,'utf16le').toString('base64')],{windowsHide:true,timeout:120000})}
  catch(e){const code=(e as {code?:number}).code;throw Error(code===12?'Zamknij OBS i spróbuj ponownie.':code===13?'Nieobsługiwana wersja OBS.':'Instalacja anulowana lub nie powiodła się.')}
  return true
 }finally{busy=false}
}

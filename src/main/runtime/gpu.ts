import {execFile,type ChildProcess} from 'node:child_process'
import {join} from 'node:path'
// Windows GPU engine utilization counters.
const script="$ErrorActionPreference='Stop'; $g=Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine; $m=@{}; foreach($x in $g){if($x.Name -match 'luid_.*_phys_\\d+_eng_\\d+_engtype_.*$'){$k=$Matches[0];$m[$k]=[double]$m[$k]+[double]$x.UtilizationPercentage}}; if($m.Count -gt 0){[Console]::WriteLine([Math]::Min(100,($m.Values|Measure-Object -Maximum).Maximum).ToString([Globalization.CultureInfo]::InvariantCulture))}"
export class GpuSampler{
 private child?:ChildProcess
 private timer?:ReturnType<typeof setInterval>
 private last?:{at:number;value:number}
 private generation=0
 start(){
  this.stop();if(process.platform!=='win32')return
  const g=++this.generation
  const poll=()=>{if(this.child||g!==this.generation)return;const path=join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe')
   this.child=execFile(path,['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:8000,maxBuffer:4096},(error,stdout)=>{if(g!==this.generation)return;this.child=undefined;const text=stdout.trim(),value=Number(text);if(!error&&text&&Number.isFinite(value)&&value>=0&&value<=100)this.last={at:Date.now(),value}})
  }
  poll();this.timer=setInterval(poll,60000);this.timer.unref?.()
 }
 stop(){this.generation++;clearInterval(this.timer);this.timer=undefined;this.child?.kill();this.child=undefined;this.last=undefined}
 snapshot(){return this.last&&Date.now()-this.last.at<=90000?this.last:null}
}

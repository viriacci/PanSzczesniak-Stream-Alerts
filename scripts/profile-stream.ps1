param([int]$Seconds=120,[int]$Interval=2,[string]$Label="Studio",[string]$Game="",[string]$Output="pssa-profile.csv")
$ErrorActionPreference="Stop"
if($Seconds -lt 10 -or $Seconds -gt 3600 -or $Interval -lt 1 -or $Interval -gt 10){throw "Invalid measurement interval"}
if(Test-Path $Output){throw "Choose a new output file"}
$cores=[Environment]::ProcessorCount
$names=@("PSSA 2 Dev","obs64");if($Game){$names+=$Game}
$last=@{};$clock=[Diagnostics.Stopwatch]::StartNew();$previous=0
while($clock.Elapsed.TotalSeconds -le $Seconds){
 $elapsed=$clock.Elapsed.TotalSeconds;$delta=$elapsed-$previous;$rows=@()
 $processes=@(Get-Process -Name $names -ErrorAction SilentlyContinue)
 foreach($name in $names){
  $set=@($processes | Where-Object ProcessName -eq $name);$cpu=0;$known=0;$ram=0;$private=0
  foreach($p in $set){
   try{$key="$($p.Id):$($p.StartTime.Ticks)";$v=$p.TotalProcessorTime.TotalSeconds;$ram+=$p.WorkingSet64;$private+=$p.PrivateMemorySize64;if($last.ContainsKey($key)){$cpu+=[Math]::Max(0,$v-$last[$key]);$known++};$last[$key]=$v}catch{}
  }
  $pct=if($known -gt 0 -and $delta -gt 0){[Math]::Round(100*$cpu/($delta*$cores),3)}else{$null}
  $rows+=[pscustomobject]@{Utc=[DateTime]::UtcNow.ToString("o");Mode=$Label;Process=$name;Count=$set.Count;CPUPercentMachine=$pct;WorkingSetMB=[Math]::Round($ram/1MB,1);PrivateMB=[Math]::Round($private/1MB,1);LogicalCores=$cores}
 }
 $rows | Export-Csv -LiteralPath $Output -NoTypeInformation -Append -Encoding UTF8
 $previous=$elapsed;Start-Sleep -Seconds $Interval
}

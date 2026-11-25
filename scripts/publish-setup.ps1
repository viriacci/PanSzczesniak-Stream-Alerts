$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$payload=@(Get-ChildItem (Join-Path $root 'dist') -Filter 'PSSA-2.0.0-*-x64.exe' -File)
if($payload.Count -ne 1){throw 'Expected one NSIS payload'}
$hashFile=Join-Path $root 'dist\payload.sha256'
(Get-FileHash -LiteralPath $payload[0].FullName -Algorithm SHA256).Hash | Set-Content -Encoding ascii $hashFile
dotnet publish (Join-Path $root 'setup\Pssa.Setup.csproj') -c Release -r win-x64 --self-contained true -o (Join-Path $root 'dist\custom') "-p:PayloadPath=$($payload[0].FullName)" "-p:PayloadHashPath=$hashFile"
if($LASTEXITCODE -ne 0){throw 'Custom setup build failed'}
$exe=Join-Path $root 'dist\custom\PSSA.Setup.exe'
if(!(Test-Path $exe)){throw 'Custom setup missing'}
$version=(Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$final=Join-Path $root "dist\PSSA-Setup-$version-x64.exe"
Copy-Item -LiteralPath $exe -Destination $final
(Get-FileHash -LiteralPath $final -Algorithm SHA256).Hash.ToLowerInvariant()+"  "+(Split-Path $final -Leaf) | Set-Content -Encoding ascii (Join-Path $root 'dist\SHA256SUMS.txt')

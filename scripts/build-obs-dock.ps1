$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$temp=Join-Path ([IO.Path]::GetTempPath()) ('pssa-obs-'+[Guid]::NewGuid().ToString('N'))
git clone --no-checkout https://github.com/obsproject/obs-plugintemplate.git $temp
if($LASTEXITCODE -ne 0){throw 'OBS template clone failed'}
try{
  git -C $temp checkout --detach 3e7d7ac3b5342cd7d9b88890b9c70b472d1520fc
  if($LASTEXITCODE -ne 0){throw 'OBS template checkout failed'}
  $spec=Get-Content (Join-Path $temp 'buildspec.json') -Raw | ConvertFrom-Json
  $spec.name='pssa-control-dock';$spec.displayName='PSSA Control Dock';$spec.version='2.0.0';$spec.author='Pan Szczesniak';$spec.website='https://github.com/viriacci/PanSzczesniak-Stream-Alerts'
  $spec | ConvertTo-Json -Depth 20 | Set-Content (Join-Path $temp 'buildspec.json') -Encoding utf8NoBOM
  $cmake=Join-Path $temp 'CMakeLists.txt'
  $source=(Get-Content $cmake -Raw).Replace('Qt6 COMPONENTS Widgets Core','Qt6 REQUIRED COMPONENTS Widgets Core Network').Replace('Qt6::Core Qt6::Widgets','Qt6::Core Qt6::Widgets Qt6::Network').Replace('src/plugin-main.c','src/pssa-dock.cpp')
  Set-Content -LiteralPath $cmake -Value $source -Encoding utf8NoBOM
  Copy-Item -LiteralPath (Join-Path $repo 'obs-dock/pssa-dock.cpp') -Destination (Join-Path $temp 'src/pssa-dock.cpp')
  node (Join-Path $repo 'scripts/generate-dock-locales.mjs') (Join-Path $temp 'src/pssa-locales.generated.h')
  if($LASTEXITCODE -ne 0){throw 'Dock locale generation failed'}
  Push-Location $temp
  try{
    cmake --preset windows-x64 -DENABLE_FRONTEND_API=ON -DENABLE_QT=ON
    if($LASTEXITCODE -ne 0){throw 'OBS SDK configure failed'}
    cmake --build --preset windows-x64 --config RelWithDebInfo
    if($LASTEXITCODE -ne 0){throw 'OBS dock compile failed'}
    $dll=@(Get-ChildItem build_x64 -Recurse -File -Filter 'pssa-control-dock.dll' | Where-Object { $_.FullName -notmatch 'rundir' })
    if($dll.Count -lt 1){throw 'Dock DLL missing'}
    $out=Join-Path $repo 'build/obs-dock'
    New-Item -ItemType Directory -Path $out -Force | Out-Null
    Copy-Item -LiteralPath $dll[0].FullName -Destination (Join-Path $out 'pssa-control-dock.dll') -Force
    $license=@(Get-ChildItem $temp -File | Where-Object {$_.Name -match '^(LICENSE|COPYING)(\.txt|\.md)?$'})
    if($license.Count -lt 1){throw 'OBS template license missing'}
    Copy-Item -LiteralPath $license[0].FullName -Destination (Join-Path $out 'COPYING') -Force
  }finally{Pop-Location}
}finally{Remove-Item -LiteralPath $temp -Recurse -Force}

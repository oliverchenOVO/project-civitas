$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskKit=[IO.Path]::GetFullPath((Join-Path $taskRoot 'artifacts/qa/shutdown-closure/repro-kit'))
if(-not $taskKit.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'QA kit must stay inside workspace'}
if(Test-Path -LiteralPath $taskKit){throw 'Do not overwrite an existing reproducibility kit'}
New-Item -ItemType Directory -Path (Join-Path $taskKit 'scripts'),(Join-Path $taskKit 'artifacts/qa'),(Join-Path $taskKit 'release/0.3.0'),(Join-Path $taskKit 'runtimes') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $taskRoot 'release/0.3.0/CIVITAS-0.3.0-Windows-portable.exe') -Destination (Join-Path $taskKit 'release/0.3.0')
Copy-Item -LiteralPath (Join-Path $taskRoot 'release/0.3.0/win-unpacked') -Destination (Join-Path $taskKit 'release/0.3.0/win-unpacked') -Recurse
Copy-Item -LiteralPath (Join-Path $taskRoot 'node_modules/electron/dist') -Destination (Join-Path $taskKit 'runtimes/current') -Recurse
Copy-Item -LiteralPath (Join-Path $taskRoot 'artifacts/qa/shutdown-closure/minimal-packaged') -Destination (Join-Path $taskKit 'runtimes/minimal-packaged') -Recurse
foreach($taskFile in @('shutdown-closure.ps1','repro-electron-quit.cjs')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $taskFile) -Destination (Join-Path $taskKit 'scripts')}
'{"name":"civitas-shutdown-qa","version":"0.3.0"}' | Set-Content -LiteralPath (Join-Path $taskKit 'package.json') -Encoding utf8
$taskRunner=@'
$ErrorActionPreference='Stop'
$taskShell=(Get-Process -Id $PID).Path
$taskHarness=Join-Path $PSScriptRoot 'scripts/shutdown-closure.ps1'
Push-Location $PSScriptRoot
try {
 foreach($taskCase in @(
  @{Target='Minimal';Case='second-host-raw';Runtime='runtimes/current/electron.exe'},
  @{Target='PackagedMinimal';Case='second-host-packaged-minimal';Runtime='runtimes/minimal-packaged/Exit Probe.exe'},
  @{Target='Unpacked';Case='second-host-unpacked';Runtime='runtimes/current/electron.exe'},
  @{Target='Portable';Case='second-host-portable';Runtime='runtimes/current/electron.exe'}
 )) {
  & $taskShell -NoProfile -File $taskHarness -Target $taskCase.Target -RuntimePath $taskCase.Runtime -Case $taskCase.Case -AppVersion 0.3.0 -TimeoutSeconds 10 -Repetitions 5 -StopWhenExited
  if($LASTEXITCODE -ne 0){throw "QA harness failed: $($taskCase.Case)"}
 }
 $taskResults=@()
 foreach($taskFile in @(Get-ChildItem -Path 'artifacts/qa/exit-second-host-*/result.json')){$taskResults+=@(Get-Content -LiteralPath $taskFile.FullName -Raw | ConvertFrom-Json)}
 $taskOs=Get-CimInstance Win32_OperatingSystem
 $taskBuild=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
 $taskSummary=[ordered]@{
  passed=($taskResults.Count -eq 20 -and @($taskResults | Where-Object {-not $_.passed}).Count -eq 0)
  os=$taskOs.Version;ubr=$taskBuild.UBR;electron='38.8.6'
  candidateSha256=(Get-FileHash -LiteralPath 'release/0.3.0/CIVITAS-0.3.0-Windows-portable.exe' -Algorithm SHA256).Hash.ToLowerInvariant()
  testedAt=[DateTime]::UtcNow.ToString('o');results=$taskResults
 }
 $taskSummary | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath 'artifacts/second-host-shutdown.json' -Encoding utf8
 Write-Output "Second-host native shutdown gate: $($taskSummary.passed)"
 if(-not $taskSummary.passed){exit 1}
} finally {Pop-Location}
'@
$taskRunner | Set-Content -LiteralPath (Join-Path $taskKit 'Run-ShutdownQA.ps1') -Encoding utf8
@'
# CIVITAS native shutdown reproduction kit

Extract the whole archive on Windows x64. No Node, pnpm, Unity or Blender is required.
Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Run-ShutdownQA.ps1`
or invoke the same script with installed PowerShell 7. This execution-policy flag
applies only to this process and does not change machine policy.

The exact candidate portable, companion unpacked application, current raw Electron
38.8.6 and a packaged minimal probe are included. Each case gets five repetitions
of native WM_CLOSE and the unchanged ten-second kernel/CIM gate. Lifecycle,
owned PID/creation identities, command lines, Job membership and failed-case
thread observations are written under artifacts/qa. The root summary is
artifacts/second-host-shutdown.json. Failed-case cleanup never counts as success.

Verify portable SHA-256 before testing:
e1a8570ade13912697bd40a165df06a7f4868d407fc4a21dfa97a4c4a0e7577d

Record the OS build and return the artifacts directory, including failures.
This kit is prepared for a second host; preparation alone is not a second-host pass.
'@ | Set-Content -LiteralPath (Join-Path $taskKit 'README.md') -Encoding utf8
$taskHash=(Get-FileHash -LiteralPath (Join-Path $taskKit 'release/0.3.0/CIVITAS-0.3.0-Windows-portable.exe') -Algorithm SHA256).Hash.ToLowerInvariant()
if($taskHash -ne 'e1a8570ade13912697bd40a165df06a7f4868d407fc4a21dfa97a4c4a0e7577d'){throw 'QA kit candidate must match frozen tested bytes'}
Write-Output "Prepared reproducibility kit: $taskKit"

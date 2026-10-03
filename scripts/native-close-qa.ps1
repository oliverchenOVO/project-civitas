param([switch]$Dev, [ValidateRange(1,100)][int]$Repetitions=3, [string]$AppVersion,
    [ValidatePattern('^[a-z0-9-]+\.json$')][string]$ReportName,
    [ValidatePattern('^[a-z0-9-]+$')][string]$CasePrefix='acceptance')
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if(-not $AppVersion){$AppVersion=(Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version}
$targets=@('Unpacked','Portable')
if($Dev){$targets=@('Minimal')}
$results=@()
$harnessErrors=@()
foreach($target in $targets){
    $caseName=$CasePrefix+'-'+$target.ToLowerInvariant()
    & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'exit-investigation.ps1') -Target $target -Case $caseName -AppVersion $AppVersion -TimeoutSeconds 10 -Repetitions $Repetitions -StopWhenExited
    $harnessFailed=$LASTEXITCODE -ne 0
    $casePath=Join-Path $taskRoot ('artifacts/qa/exit-'+$caseName+'/result.json')
    if(Test-Path -LiteralPath $casePath){$results += @(Get-Content -LiteralPath $casePath -Raw | ConvertFrom-Json)}
    if($harnessFailed){$harnessErrors += "Investigation harness failed: $target; retain completed cases and do not count uncompleted repetitions as passes."}
}
$passed=$harnessErrors.Count -eq 0 -and $results.Count -eq $targets.Count*$Repetitions -and @($results | Where-Object { -not $_.passed -or -not $_.windowClosed -or -not $_.mainExited -or -not $_.allChildrenExited -or $_.forceCleanupPerformed -or $_.cimRowsAfterHandleRelease -ne 0 -or $_.finalCimAbsenceCheckMs -gt 10000 }).Count -eq 0
$summary=[ordered]@{
    passed=$passed
    appVersion=$AppVersion
    acceptance='WM_CLOSE; main and every discovered descendant exit voluntarily; kernel signals and exit codes; PID+creation identity absent from CIM after releasing observer handles; no force kill; all within 10 seconds.'
    timeoutSeconds=10
    repetitionsPerVariant=$Repetitions
    completedRuns=$results.Count
    expectedRuns=$targets.Count*$Repetitions
    harnessErrors=$harnessErrors
    electronVersion=(Get-Content -LiteralPath (Join-Path $taskRoot 'node_modules/electron/package.json') -Raw | ConvertFrom-Json).version
    testedAt=[DateTime]::UtcNow.ToString('o')
    results=@($results | Select-Object case,target,iteration,rootPid,mainPid,launched,windowClosed,mainExited,allChildrenExited,kernelExitUpperBoundMs,exitLatencyUpperBoundMs,finalCimAbsenceCheckMs,cimRowsAfterHandleRelease,remainingProcesses,forceCleanupPerformed,passed)
}
$taskReportName='native-close-qa.json'
if($Dev){$taskReportName='native-close-dev-qa.json'}
if($ReportName){$taskReportName=$ReportName}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskRoot ('artifacts/'+$taskReportName)) -Encoding utf8
Write-Host "Native exit acceptance: $passed ($($results.Count) runs)"
if(-not $passed){exit 1}

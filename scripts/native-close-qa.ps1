param([switch]$Dev, [int]$Repetitions=3)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$targets=@('Unpacked','Portable')
if($Dev){$targets=@('Minimal')}
$results=@()
foreach($target in $targets){
    $caseName='acceptance-'+$target.ToLowerInvariant()
    & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'exit-investigation.ps1') -Target $target -Case $caseName -TimeoutSeconds 10 -Repetitions $Repetitions -StopWhenExited
    if($LASTEXITCODE -ne 0){throw "Investigation harness failed: $target"}
    $casePath=Join-Path $taskRoot ('artifacts/qa/exit-'+$caseName+'/result.json')
    $results += @(Get-Content -LiteralPath $casePath -Raw | ConvertFrom-Json)
}
$passed=@($results | Where-Object { -not $_.passed -or -not $_.windowClosed -or -not $_.mainExited -or -not $_.allChildrenExited -or $_.forceCleanupPerformed -or $_.cimRowsAfterHandleRelease -ne 0 -or $_.finalCimAbsenceCheckMs -gt 10000 }).Count -eq 0
$summary=[ordered]@{
    passed=$passed
    acceptance='WM_CLOSE; main and every discovered descendant exit voluntarily; kernel signals and exit codes; PID+creation identity absent from CIM after releasing observer handles; no force kill; all within 10 seconds.'
    timeoutSeconds=10
    repetitionsPerVariant=$Repetitions
    electronVersion=(Get-Content -LiteralPath (Join-Path $taskRoot 'node_modules/electron/package.json') -Raw | ConvertFrom-Json).version
    testedAt=[DateTime]::UtcNow.ToString('o')
    results=@($results | Select-Object case,target,iteration,rootPid,mainPid,launched,windowClosed,mainExited,allChildrenExited,exitLatencyUpperBoundMs,finalCimAbsenceCheckMs,cimRowsAfterHandleRelease,remainingProcesses,forceCleanupPerformed,passed)
}
$reportName='native-close-qa.json'
if($Dev){$reportName='native-close-dev-qa.json'}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskRoot ('artifacts/'+$reportName)) -Encoding utf8
Write-Host "Native exit acceptance: $passed ($($results.Count) runs)"
if(-not $passed){exit 1}

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$results = @()
foreach ($relative in @('release/0.1.0/win-unpacked/Project CIVITAS.exe', 'release/0.1.0/CIVITAS-0.1.0-Windows-portable.exe')) {
    $executable = Join-Path $workspace $relative
    $started = Get-Date
    $launcher = Start-Process -FilePath $executable -PassThru -WindowStyle Hidden
    $deadline = $started.AddSeconds(60)
    $window = $null
    while ((Get-Date) -lt $deadline) {
        $window = Get-Process -Name 'Project CIVITAS' -ErrorAction SilentlyContinue |
            Where-Object { $_.StartTime -ge $started.AddSeconds(-1) -and $_.MainWindowHandle -ne 0 } |
            Select-Object -First 1
        if ($window) { break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $window) { throw "No native window appeared: $relative" }
    $title = $window.MainWindowTitle
    if ($title -ne 'Project CIVITAS') { throw "Unexpected title: $title" }
    Start-Sleep -Seconds 2
    if (-not $window.CloseMainWindow()) { throw "Native close failed: $relative" }
    if (-not $window.WaitForExit(10000)) { throw "Native process did not exit normally: $relative" }
    if (-not $launcher.WaitForExit(10000)) { throw "Portable launcher did not exit: $relative" }
    $results += [pscustomobject]@{ executable = $relative; launched = $true; title = $title; normalWindowClose = $true; exitCode = $window.ExitCode }
    Write-Host "PASS: native launch and normal window close: $relative"
}
$report = [pscustomobject]@{ passed = $true; testedAt = (Get-Date).ToString('o'); results = $results }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $workspace 'artifacts/native-close-qa.json') -Encoding utf8

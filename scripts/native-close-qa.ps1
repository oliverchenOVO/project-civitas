param([switch]$Dev, [string]$DevEntry = '.')
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$results = @()
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CivitasNativeWindow {
  public delegate bool Callback(IntPtr window, IntPtr data);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback callback, IntPtr data);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder text, int count);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder text, int count);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr window, uint message, IntPtr w, IntPtr l);
  public static IntPtr Find(int processId) {
    IntPtr result = IntPtr.Zero;
    EnumWindows((window, data) => {
      uint pid; GetWindowThreadProcessId(window, out pid);
      if (pid == processId) {
        var title = new StringBuilder(256); GetWindowText(window, title, 256);
        var className = new StringBuilder(256); GetClassName(window, className, 256);
        if (title.ToString() == "Project CIVITAS" && className.ToString() == "Chrome_WidgetWin_1") { result = window; return false; }
      }
      return true;
    }, IntPtr.Zero);
    return result;
  }
  public static bool Close(IntPtr window) { return PostMessage(window, 0x0010, IntPtr.Zero, IntPtr.Zero); }
}
'@
$targets = @('release/0.1.0/win-unpacked/Project CIVITAS.exe', 'release/0.1.0/CIVITAS-0.1.0-Windows-portable.exe')
if ($Dev) { $targets = @('node_modules/electron/dist/electron.exe') }
foreach ($relative in $targets) {
    $executable = Join-Path $workspace $relative
    $started = Get-Date
    if ($Dev) { $launcher = Start-Process -FilePath $executable -ArgumentList $DevEntry -WorkingDirectory $workspace -PassThru -WindowStyle Hidden }
    else { $launcher = Start-Process -FilePath $executable -PassThru -WindowStyle Hidden }
    $deadline = $started.AddSeconds(60)
    $window = $null
    $windowHandle = [IntPtr]::Zero
    while ((Get-Date) -lt $deadline) {
        foreach ($candidate in (Get-Process -Name 'Project CIVITAS','electron' -ErrorAction SilentlyContinue)) {
            if ($candidate.StartTime -lt $started.AddSeconds(-1)) { continue }
            $windowHandle = [CivitasNativeWindow]::Find($candidate.Id)
            if ($windowHandle -ne [IntPtr]::Zero) { $window = $candidate; break }
        }
        if ($window) { break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $window) { throw "No native window appeared: $relative" }
    $title = 'Project CIVITAS'
    Start-Sleep -Seconds 2
    if (-not [CivitasNativeWindow]::Close($windowHandle)) { throw "Native close failed: $relative" }
    $closeStarted = Get-Date
    $processExited = $window.WaitForExit(60000)
    $launcherExited = $false
    if ($processExited) { $launcherExited = $launcher.WaitForExit(10000) }
    $exitCode = $null
    if ($processExited) { $exitCode = $window.ExitCode }
    $windowClosed = [CivitasNativeWindow]::Find($window.Id) -eq [IntPtr]::Zero
    $results += [pscustomobject]@{ executable = $relative; launched = $true; title = $title; nativeWindowClosed = $windowClosed; processExited = $processExited; launcherExited = $launcherExited; normalWindowClose = ($processExited -and $launcherExited); exitCode = $exitCode; shutdownMs = [math]::Round(((Get-Date) - $closeStarted).TotalMilliseconds) }
    if ($processExited -and $launcherExited) { Write-Host "PASS: native launch and normal exit: $relative" }
    else {
        Write-Warning "BLOCKED: native window close=$windowClosed, process remains after 60 seconds: $relative"
        # Clean up only the process trees started by this test.
        & taskkill.exe /PID $window.Id /T /F 2>$null | Out-Null
        if ($launcher.Id -ne $window.Id) { & taskkill.exe /PID $launcher.Id /T /F 2>$null | Out-Null }
    }
}
$passed = @($results | Where-Object { -not $_.normalWindowClose }).Count -eq 0
$report = [pscustomobject]@{ passed = $passed; testedAt = (Get-Date).ToString('o'); results = $results }
$reportName = 'native-close-qa.json'
if ($Dev) { $reportName = 'native-close-dev-qa.json' }
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $workspace ('artifacts/' + $reportName)) -Encoding utf8
if (-not $passed) { exit 1 }

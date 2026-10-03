param(
    [ValidateSet('Minimal','Unpacked','Portable','PackagedMinimal')][string]$Target = 'Minimal',
    [string]$RuntimePath = 'node_modules/electron/dist/electron.exe',
    [string]$Case = 'baseline',
    [ValidateSet('StartProcess','Console','Detached','Playwright')][string]$Launcher = 'StartProcess',
    [switch]$GpuOff,
    [ValidateSet('quit','exit')][string]$ExitMode = 'quit',
    [int]$TimeoutSeconds = 60,
    [int]$Repetitions = 1,
    [switch]$StopWhenExited
)
$ErrorActionPreference = 'Stop'
if($Case -notmatch '^[a-z0-9-]+$'){throw 'Case must be a lowercase artifact directory label'}
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskOutput = Join-Path $taskRoot ('artifacts/qa/exit-' + $Case)
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class CivitasExitNative {
 public delegate bool Callback(IntPtr hwnd, IntPtr arg);
 [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr arg);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int n);
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int n);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd,uint msg,IntPtr w,IntPtr l);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
 [DllImport("kernel32.dll")] public static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll")] public static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
 public static IntPtr Find(int id) {
  IntPtr found=IntPtr.Zero;
  EnumWindows((hwnd,arg)=>{
   uint pid;GetWindowThreadProcessId(hwnd,out pid);
   if(pid==id){
    var title=new StringBuilder(256);var cls=new StringBuilder(256);
    GetWindowText(hwnd,title,256);GetClassName(hwnd,cls,256);
    if(title.ToString()=="Project CIVITAS" && cls.ToString()=="Chrome_WidgetWin_1"){found=hwnd;return false;}
   }return true;
  },IntPtr.Zero);return found;
 }
}
'@
function Role($row, $rootId) {
    if ($row.Name -eq 'node.exe') { return 'qa-launcher' }
    if ($row.CommandLine -match '--type=([^ "\s]+)') { return $Matches[1] }
    if ($row.Name -match 'crashpad') { return 'crashpad-handler' }
    if ($row.ProcessId -eq $rootId -and $Target -eq 'Portable') { return 'portable-wrapper' }
    return 'browser-main'
}
$runs = @()
for ($iteration=1; $iteration -le $Repetitions; $iteration++) {
    $taskLog = Join-Path $taskOutput ("lifecycle-$iteration.jsonl")
    if(Test-Path -LiteralPath $taskLog){Remove-Item -LiteralPath $taskLog -Force}
    $previousEnv = @{}
    foreach ($name in @('CIVITAS_EXIT_LOG','CIVITAS_EXIT_GPU_OFF','CIVITAS_EXIT_MODE','ELECTRON_RUN_AS_NODE','CIVITAS_DEV_URL')) {
        $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name)
    }
    $env:CIVITAS_EXIT_LOG = $taskLog
    $env:CIVITAS_EXIT_GPU_OFF = $(if($GpuOff){'1'}else{'0'})
    $env:CIVITAS_EXIT_MODE = $ExitMode
    Remove-Item Env:ELECTRON_RUN_AS_NODE,Env:CIVITAS_DEV_URL -ErrorAction SilentlyContinue
    $executable = switch($Target) {
        'Minimal' { Join-Path $taskRoot $RuntimePath }
        'Unpacked' { Join-Path $taskRoot 'release/0.1.0/win-unpacked/Project CIVITAS.exe' }
        'Portable' { Join-Path $taskRoot 'release/0.1.0/CIVITAS-0.1.0-Windows-portable.exe' }
        'PackagedMinimal' { Join-Path $taskRoot $RuntimePath }
    }
    $arguments = @()
    if ($Target -eq 'Minimal') { $arguments = @('"' + (Join-Path $taskRoot 'scripts/repro-electron-quit.cjs') + '"') }
    if($Launcher -eq 'Playwright') {
        if($Target -ne 'Minimal'){throw 'Playwright launcher experiment is limited to minimal probe'}
        $arguments=@('"' + (Join-Path $taskRoot 'node_modules/tsx/dist/cli.mjs') + '"', '"' + (Join-Path $taskRoot 'scripts/exit-playwright-launch.ts') + '"', '"' + $executable + '"')
        $executable=(Get-Command node).Source
    }
    $launchStart = [DateTime]::UtcNow
    if ($Launcher -eq 'StartProcess') {
        $options = @{FilePath=$executable; WorkingDirectory=$taskRoot; PassThru=$true; WindowStyle='Hidden'}
        if($arguments.Count){$options.ArgumentList=$arguments}
        $rootProcess = Start-Process @options
    } else {
        $info = [Diagnostics.ProcessStartInfo]::new($executable)
        $info.WorkingDirectory=$taskRoot
        $info.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
        $info.UseShellExecute = $Launcher -eq 'Detached'
        $info.Arguments = $arguments -join ' '
        $info.RedirectStandardOutput=$false
        $info.RedirectStandardError=$false
        $rootProcess=[Diagnostics.Process]::Start($info)
    }
    foreach ($name in $previousEnv.Keys) { [Environment]::SetEnvironmentVariable($name,$previousEnv[$name]) }
    $rootId = $rootProcess.Id
    $known = @{}
    $samples = [Collections.Generic.List[object]]::new()
    function Snapshot([string]$label,[double]$elapsed) {
        $rows = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine,CreationDate)
        $discover = $true
        while ($discover) {
            $discover=$false
            foreach($row in $rows) {
                if($known.ContainsKey([int]$row.ProcessId)){continue}
                if(($row.ProcessId -eq $rootId -or $known.ContainsKey([int]$row.ParentProcessId)) -and $row.CreationDate.ToUniversalTime() -ge $launchStart.AddSeconds(-1)) {
                    $handle=[CivitasExitNative]::OpenProcess(0x101000,$false,$row.ProcessId)
                    $known[[int]$row.ProcessId]=@{ metadata=$row; role=(Role $row $rootId); handle=$handle; exitObservedAt=$null }
                    $discover=$true
                }
            }
        }
        $observations=@()
        foreach($id in @($known.Keys | Sort-Object)) {
            $entry=$known[$id]; [uint32]$code=259
            $signaled=$false
            if($entry.handle -ne [IntPtr]::Zero) {
                $signaled=[CivitasExitNative]::WaitForSingleObject($entry.handle,0) -eq 0
                [void][CivitasExitNative]::GetExitCodeProcess($entry.handle,[ref]$code)
            }
            $present=@($rows | Where-Object { $_.ProcessId -eq $id -and $_.CreationDate -eq $entry.metadata.CreationDate }).Count -gt 0
            if(($signaled -or -not $present) -and -not $entry.exitObservedAt) { $entry.exitObservedAt=[DateTime]::UtcNow.ToString('o') }
            $observations += [pscustomobject]@{ pid=$id; ppid=$entry.metadata.ParentProcessId; role=$entry.role; name=$entry.metadata.Name; executablePath=$entry.metadata.ExecutablePath; commandLine=$entry.metadata.CommandLine; startTime=$entry.metadata.CreationDate.ToUniversalTime().ToString('o'); cimPresent=$present; kernelSignaled=$signaled; exitCode=$code; alive=(-not $signaled -and $present); exitObservedAt=$entry.exitObservedAt }
        }
        if($label -like 'close+*'){ $elapsed=$clock.Elapsed.TotalMilliseconds }
        $sample=[pscustomobject]@{label=$label; timestamp=[DateTime]::UtcNow.ToString('o'); elapsedMs=[math]::Round($elapsed); processes=$observations}
        $samples.Add($sample)
        return $sample
    }
    $windowHandle=[IntPtr]::Zero; $mainId=$null; $legacyWindowProcess=$null
    $deadline=[DateTime]::UtcNow.AddSeconds(60)
    while([DateTime]::UtcNow -lt $deadline) {
        $sample=Snapshot 'launch' 0
        foreach($id in $known.Keys) {
            $windowHandle=[CivitasExitNative]::Find($id)
            if($windowHandle -ne [IntPtr]::Zero){$mainId=$id;break}
        }
        if($mainId){break}
        Start-Sleep -Milliseconds 250
    }
    if(-not $mainId){throw "No owned native window: $Case"}
    $legacyWindowProcess=Get-Process -Id $mainId
    Start-Sleep -Seconds 3
    [void](Snapshot 'before-close' 0)
    $clock=[Diagnostics.Stopwatch]::StartNew()
    if(-not [CivitasExitNative]::PostMessage($windowHandle,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)){throw 'WM_CLOSE failed'}
    $final=$null
    foreach($seconds in @(0,1,3,5,10,30,60) | Where-Object { $_ -le $TimeoutSeconds }) {
        $sleep=[math]::Max(0, $seconds*1000-$clock.ElapsedMilliseconds)
        if($sleep -gt 0){Start-Sleep -Milliseconds $sleep}
        $final=Snapshot "close+$($seconds)s" $clock.Elapsed.TotalMilliseconds
        Write-Host "$Case #$iteration t+$($seconds)s remaining: $(@($final.processes | Where-Object alive | ForEach-Object { "$($_.pid):$($_.role)" }) -join ', ')"
        if($StopWhenExited -and @($final.processes | Where-Object alive).Count -eq 0){break}
    }
    $lifecycle=@()
    if(Test-Path -LiteralPath $taskLog){$lifecycle=@(Get-Content -LiteralPath $taskLog | ForEach-Object { $_ | ConvertFrom-Json })}
    $remaining=@($final.processes | Where-Object alive)
    $firstGone=$samples | Where-Object { $_.label -like 'close+*' -and @($_.processes | Where-Object alive).Count -eq 0 } | Select-Object -First 1
    $legacyWindowWait=$legacyWindowProcess.WaitForExit(0)
    $legacyRootWait=$rootProcess.WaitForExit(0)
    $run=[pscustomobject]@{ case=$Case; target=$Target; launcher=$Launcher; gpuOff=[bool]$GpuOff; exitMode=$ExitMode; iteration=$iteration; rootPid=$rootId; mainPid=$mainId; executable=$executable; launched=$true; windowClosed=([CivitasExitNative]::Find($mainId) -eq [IntPtr]::Zero); mainExited=(@($remaining | Where-Object pid -eq $mainId).Count -eq 0); allChildrenExited=(@($remaining | Where-Object pid -ne $mainId).Count -eq 0); exitLatencyUpperBoundMs=$(if($firstGone){$firstGone.elapsedMs}else{$null}); passed=($remaining.Count -eq 0 -and $firstGone.elapsedMs -le 10000); legacyWindowWaitForExit=$legacyWindowWait; legacyRootWaitForExit=$legacyRootWait; remainingProcesses=$remaining; lifecycleEvents=$lifecycle; samples=$samples.ToArray(); measuredBeforeCleanup=$true; forceCleanupPerformed=($remaining.Count -gt 0) }
    # Cleanup is separate from results; only test-owned, still-live identities.
    foreach($entry in $known.Values){if($entry.handle -ne [IntPtr]::Zero){[void][CivitasExitNative]::CloseHandle($entry.handle)}}
    if($remaining.Count) {
        foreach($row in $remaining) {
            $still=Get-CimInstance Win32_Process -Filter "ProcessId=$($row.pid)" -ErrorAction SilentlyContinue
            if($still -and $still.CreationDate.ToUniversalTime().ToString('o') -eq $row.startTime) {
                & taskkill.exe /PID $row.pid /F 2>$null | Out-Null
            }
        }
    }
    $rootProcess.Dispose()
    $legacyWindowProcess.Dispose()
    if($remaining.Count -eq 0) {
        Start-Sleep -Milliseconds 100
        $left=@(Get-CimInstance Win32_Process | Where-Object { $known.ContainsKey([int]$_.ProcessId) -and $_.CreationDate -eq $known[[int]$_.ProcessId].metadata.CreationDate })
        $run | Add-Member -NotePropertyName cimRowsAfterHandleRelease -NotePropertyValue $left.Count
        $run | Add-Member -NotePropertyName finalCimAbsenceCheckMs -NotePropertyValue ([math]::Round($clock.Elapsed.TotalMilliseconds))
        if($left.Count -gt 0){$run.passed=$false}
    }
    $runs += $run
    $runs | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $taskOutput 'result.json') -Encoding utf8
}
Write-Host "Evidence: artifacts/qa/exit-$Case/result.json"

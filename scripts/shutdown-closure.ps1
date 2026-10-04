param(
    [ValidateSet('Minimal','Unpacked','Portable','PackagedMinimal','RuntimeExperiment')][string]$Target = 'Minimal',
    [string]$RuntimePath = 'node_modules/electron/dist/electron.exe',
    [string]$Case = 'baseline',
    [ValidateSet('StartProcess','Console','Detached','Playwright')][string]$Launcher = 'StartProcess',
    [switch]$GpuOff,
    [ValidateSet('quit','exit')][string]$ExitMode = 'quit',
    [int]$TimeoutSeconds = 60,
    [ValidateRange(1,100)][int]$Repetitions = 1,
    [string]$AppVersion,
    [switch]$StopWhenExited,
    [switch]$SandboxOff,
    [switch]$Stress
)
$ErrorActionPreference = 'Stop'
if($Case -notmatch '^[a-z0-9-]+$'){throw 'Case must be a lowercase artifact directory label'}
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if(-not $AppVersion){$AppVersion=(Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version}
if($AppVersion -notmatch '^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$'){throw 'Invalid app version'}
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
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool result);
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
    if ($row.Name -eq 'cmd.exe') { return 'console-wrapper' }
    if ($row.Name -eq 'esbuild.exe') { return 'qa-transpiler' }
    if ($row.CommandLine -match '--type=([^ "\s]+)') { return $Matches[1] }
    if ($row.Name -match 'crashpad') { return 'crashpad-handler' }
    if ($row.ProcessId -eq $rootId -and $Target -eq 'Portable') { return 'portable-wrapper' }
    return 'browser-main'
}
$runs = @()
for ($iteration=1; $iteration -le $Repetitions; $iteration++) {
    $taskLog = Join-Path $taskOutput ("lifecycle-$iteration.jsonl")
    $taskReady = Join-Path $taskOutput 'playwright-owner.json'
    if($Launcher -eq 'Playwright' -and (Test-Path -LiteralPath $taskReady)){Remove-Item -LiteralPath $taskReady -Force}
    if(Test-Path -LiteralPath $taskLog){Remove-Item -LiteralPath $taskLog -Force}
    $previousEnv = @{}
    foreach ($name in @('CIVITAS_EXIT_LOG','CIVITAS_EXIT_GPU_OFF','CIVITAS_EXIT_MODE','CIVITAS_PROBE_SANDBOX','ELECTRON_RUN_AS_NODE','CIVITAS_DEV_URL')) {
        $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name)
    }
    $env:CIVITAS_EXIT_LOG = $taskLog
    $env:CIVITAS_EXIT_GPU_OFF = $(if($GpuOff){'1'}else{'0'})
    $env:CIVITAS_EXIT_MODE = $ExitMode
    $env:CIVITAS_PROBE_SANDBOX = $(if($SandboxOff){'0'}else{'1'})
    Remove-Item Env:ELECTRON_RUN_AS_NODE,Env:CIVITAS_DEV_URL -ErrorAction SilentlyContinue
    $executable = switch($Target) {
        'Minimal' { Join-Path $taskRoot $RuntimePath }
        'Unpacked' { Join-Path $taskRoot "release/$AppVersion/win-unpacked/Project CIVITAS.exe" }
        'Portable' { Join-Path $taskRoot "release/$AppVersion/CIVITAS-$AppVersion-Windows-portable.exe" }
        'PackagedMinimal' { Join-Path $taskRoot $RuntimePath }
        'RuntimeExperiment' { Join-Path $taskRoot $RuntimePath }
    }
    $arguments = @()
    if ($Target -eq 'Minimal') { $arguments = @('"' + (Join-Path $taskRoot 'scripts/repro-electron-quit.cjs') + '"') }
    if($Launcher -eq 'Playwright') {
        if($Target -ne 'Minimal' -and -not ($Target -in @('Unpacked','RuntimeExperiment') -and $Stress)){throw 'Use Minimal, or an explicitly isolated product stress control'}
        $arguments=@('"' + (Join-Path $taskRoot 'node_modules/tsx/dist/cli.mjs') + '"', '"' + (Join-Path $taskRoot 'scripts/exit-playwright-launch.ts') + '"', '"' + $executable + '"')
        if($Stress){$arguments += 'stress'}
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
        if($label -like 'close+*') {
            # Query the owned identity/parent closure instead of every unrelated process.
            # Repeat for newly discovered descendants, including children born after close.
            $queryIds=@($known.Keys); $rowIndex=@{}; $queried=@{}
            while($queryIds.Count) {
                $filter=($queryIds | ForEach-Object { "ProcessId=$_ OR ParentProcessId=$_" }) -join ' OR '
                $found=@(Get-CimInstance Win32_Process -Filter $filter)
                foreach($id in $queryIds){$queried[$id]=$true}
                foreach($row in $found){$rowIndex[[int]$row.ProcessId]=$row}
                $queryIds=@($found | Where-Object { -not $queried.ContainsKey([int]$_.ProcessId) } | ForEach-Object { [int]$_.ProcessId })
            }
            $rows=@($rowIndex.Values)
        } else {
            $rows = @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,CommandLine,CreationDate)
        }
        $discover = $true
        while ($discover) {
            $discover=$false
            foreach($row in $rows) {
                if($known.ContainsKey([int]$row.ProcessId)){continue}
                if(($row.ProcessId -eq $rootId -or $known.ContainsKey([int]$row.ParentProcessId)) -and $row.CreationDate.ToUniversalTime() -ge $launchStart.AddSeconds(-1)) {
                    $handle=[CivitasExitNative]::OpenProcess(0x101000,$false,$row.ProcessId)
                    [bool]$inJob=$false
                    $jobQuerySucceeded=$false
                    if($handle -ne [IntPtr]::Zero){$jobQuerySucceeded=[CivitasExitNative]::IsProcessInJob($handle,[IntPtr]::Zero,[ref]$inJob)}
                    $known[[int]$row.ProcessId]=@{ metadata=$row; role=(Role $row $rootId); handle=$handle; exitObservedAt=$null; inJob=$(if($jobQuerySucceeded){$inJob}else{$null}); jobQuerySucceeded=$jobQuerySucceeded }
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
            $observations += [pscustomobject]@{ pid=$id; ppid=$entry.metadata.ParentProcessId; role=$entry.role; name=$entry.metadata.Name; executablePath=$entry.metadata.ExecutablePath; commandLine=$entry.metadata.CommandLine; startTime=$entry.metadata.CreationDate.ToUniversalTime().ToString('o'); cimPresent=$present; kernelSignaled=$signaled; exitCode=$code; alive=(-not $signaled); exitObservedAt=$entry.exitObservedAt; inJob=$entry.inJob; jobQuerySucceeded=$entry.jobQuerySucceeded }
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
        if($mainId -and ($Launcher -ne 'Playwright' -or (Test-Path -LiteralPath $taskReady))){break}
        if($Launcher -eq 'Playwright' -and -not (Test-Path -LiteralPath $taskReady)){$mainId=$null}
        Start-Sleep -Milliseconds 250
    }
    if(-not $mainId){
        $failedRemaining=@($sample.processes | Where-Object { -not $_.kernelSignaled })
        foreach($entry in $known.Values){if($entry.handle -ne [IntPtr]::Zero){[void][CivitasExitNative]::CloseHandle($entry.handle)}}
        $rootProcess.Dispose()
        $failedFilter=(@($known.Keys) | ForEach-Object { "ProcessId=$_" }) -join ' OR '
        $failedLeft=@(Get-CimInstance Win32_Process -Filter $failedFilter | Where-Object { $_.CreationDate -eq $known[[int]$_.ProcessId].metadata.CreationDate })
        $failedCleanup=$false
        foreach($row in $failedLeft){
            $failedCleanup=$true
            & taskkill.exe /PID $row.ProcessId /F 2>$null | Out-Null
        }
        $runs += [pscustomobject]@{case=$Case;target=$Target;launcher=$Launcher;iteration=$iteration;rootPid=$rootId;launched=$false;passed=$false;kernelExited=($failedRemaining.Count -eq 0);cimAbsent=($failedLeft.Count -eq 0);lifecycleComplete=$false;error='No owned native window within 60 seconds';launchSamples=$samples.ToArray();remainingProcesses=$failedRemaining;cimRowsAfterHandleRelease=$failedLeft.Count;forceCleanupPerformed=$failedCleanup}
        $runs | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $taskOutput 'result.json') -Encoding utf8
        Write-Host "$Case #$iteration launch failed; not a close pass"
        continue
    }
    $legacyWindowProcess=Get-Process -Id $mainId
    Start-Sleep -Seconds 3
    [void](Snapshot 'before-close' 0)
    $clock=[Diagnostics.Stopwatch]::StartNew()
    if(-not [CivitasExitNative]::PostMessage($windowHandle,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)){throw 'WM_CLOSE failed'}
    $final=$null
    # Poll kernel handles without repeated full-machine WMI enumeration during shutdown.
    # Snapshot again to discover late descendants; a late observation still fails.
    $kernelExitUpperBoundMs=$null
    if($StopWhenExited) {
        do {
            $pending=@($known.Values | Where-Object { $_.handle -eq [IntPtr]::Zero -or [CivitasExitNative]::WaitForSingleObject($_.handle,0) -ne 0 })
            if($pending.Count -eq 0){$kernelExitUpperBoundMs=[math]::Round($clock.Elapsed.TotalMilliseconds);break}
            Start-Sleep -Milliseconds 50
        } while($clock.Elapsed.TotalMilliseconds -lt $TimeoutSeconds*1000)
    }
    $observationSeconds = @(0,1,3,5,10,30,60)
    if($StopWhenExited){$observationSeconds = @([math]::Floor($clock.Elapsed.TotalSeconds))}
    foreach($seconds in $observationSeconds | Where-Object { $StopWhenExited -or $_ -le $TimeoutSeconds }) {
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
    $lifeComplete=$null
    if($lifecycle.Count){$lifeComplete=@('close','closed','window-all-closed','before-quit','will-quit','node-exit','quit' | Where-Object { $_ -notin $lifecycle.event }).Count -eq 0}
    $run=[pscustomobject]@{ case=$Case; target=$Target; launcher=$Launcher; gpuOff=[bool]$GpuOff; sandboxOff=[bool]$SandboxOff; exitMode=$ExitMode; iteration=$iteration; rootPid=$rootId; mainPid=$mainId; executable=$executable; launched=$true; windowClosed=([CivitasExitNative]::Find($mainId) -eq [IntPtr]::Zero); mainExited=(@($remaining | Where-Object pid -eq $mainId).Count -eq 0); allChildrenExited=(@($remaining | Where-Object pid -ne $mainId).Count -eq 0); lifecycleComplete=$lifeComplete;kernelExited=($remaining.Count -eq 0);cimAbsent=$false;exitLatencyUpperBoundMs=$(if($firstGone){$firstGone.elapsedMs}else{$null}); passed=($remaining.Count -eq 0 -and $firstGone.elapsedMs -le 10000); legacyWindowWaitForExit=$legacyWindowWait; legacyRootWaitForExit=$legacyRootWait; remainingProcesses=$remaining; lifecycleEvents=$lifecycle; samples=$samples.ToArray(); measuredBeforeCleanup=$true; forceCleanupPerformed=$false }
    $run | Add-Member -NotePropertyName kernelExitUpperBoundMs -NotePropertyValue $kernelExitUpperBoundMs
    # Cleanup is separate from results; only test-owned, still-live identities.
    foreach($entry in $known.Values){if($entry.handle -ne [IntPtr]::Zero){[void][CivitasExitNative]::CloseHandle($entry.handle)}}
    $rootProcess.Dispose()
    $legacyWindowProcess.Dispose()
    $identityFilter=(@($known.Keys) | ForEach-Object { "ProcessId=$_" }) -join ' OR '
    $left=@(Get-CimInstance Win32_Process -Filter $identityFilter | Where-Object { $_.CreationDate -eq $known[[int]$_.ProcessId].metadata.CreationDate })
    $run.cimAbsent=$left.Count -eq 0
    $run | Add-Member -NotePropertyName cimRowsAfterHandleRelease -NotePropertyValue $left.Count
    $run | Add-Member -NotePropertyName cimRowsBeforeCleanup -NotePropertyValue @($left | Select-Object ProcessId,ParentProcessId,Name,CreationDate,CommandLine,ThreadCount,HandleCount)
    $run | Add-Member -NotePropertyName finalCimAbsenceCheckMs -NotePropertyValue ([math]::Round($clock.Elapsed.TotalMilliseconds))
    if(-not $run.cimAbsent -or $run.finalCimAbsenceCheckMs -gt 10000){$run.passed=$false}
    # Capture practical OS thread states before any failed-run cleanup.
    $threadEvidence=@()
    foreach($row in $remaining){
        try {
            $ownedProcess=Get-Process -Id $row.pid -ErrorAction Stop
            $threadEvidence += [pscustomobject]@{pid=$row.pid;cpuSeconds=$ownedProcess.TotalProcessorTime.TotalSeconds;threads=@($ownedProcess.Threads | ForEach-Object { [pscustomobject]@{id=$_.Id;state=$_.ThreadState.ToString();waitReason=$(if($_.ThreadState -eq 'Wait'){$_.WaitReason.ToString()}else{$null})} })}
            $ownedProcess.Dispose()
        } catch {$threadEvidence += [pscustomobject]@{pid=$row.pid;error=$_.Exception.Message}}
    }
    $run | Add-Member -NotePropertyName threadEvidenceBeforeCleanup -NotePropertyValue $threadEvidence
    if($remaining.Count) {
        $run.forceCleanupPerformed=$true
        foreach($row in $remaining) {
            $still=Get-CimInstance Win32_Process -Filter "ProcessId=$($row.pid)" -ErrorAction SilentlyContinue
            if($still -and $still.CreationDate.ToUniversalTime().ToString('o') -eq $row.startTime) {
                & taskkill.exe /PID $row.pid /F 2>$null | Out-Null
            }
        }
    }
    $runs += $run
    $runs | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath (Join-Path $taskOutput 'result.json') -Encoding utf8
}
Write-Host "Evidence: artifacts/qa/exit-$Case/result.json"

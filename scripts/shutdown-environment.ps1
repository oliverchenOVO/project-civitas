$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CivitasJobSnapshot {
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr p,IntPtr j,out bool r);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int cls,byte[] data,int len,out int returned);
 public static object Read() {
  bool member; bool ok=IsProcessInJob(GetCurrentProcess(),IntPtr.Zero,out member);
  var extended=new byte[144];var accounting=new byte[48];int returned;
  bool limits=QueryInformationJobObject(IntPtr.Zero,9,extended,extended.Length,out returned);
  int limitsError=Marshal.GetLastWin32Error();
  bool counts=QueryInformationJobObject(IntPtr.Zero,1,accounting,accounting.Length,out returned);
  return new { querySucceeded=ok,inJob=member,limitsQuerySucceeded=limits,limitsQueryError=limitsError,
   limitFlags=limits?(uint?)BitConverter.ToUInt32(extended,16):null,
   activeProcessLimit=limits?(uint?)BitConverter.ToUInt32(extended,40):null,
   processMemoryLimit=limits?(ulong?)BitConverter.ToUInt64(extended,112):null,
   jobMemoryLimit=limits?(ulong?)BitConverter.ToUInt64(extended,120):null,
   accountingQuerySucceeded=counts,activeProcesses=counts?(uint?)BitConverter.ToUInt32(accounting,40):null };
 }
}
'@
$taskOs=Get-CimInstance Win32_OperatingSystem
$taskVersion=Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
$taskCandidate=Join-Path $taskRoot 'release/0.3.0/CIVITAS-0.3.0-Windows-portable.exe'
$taskMachine=[ordered]@{
 collectedAt=[DateTime]::UtcNow.ToString('o')
 os=[ordered]@{caption=$taskOs.Caption;version=$taskOs.Version;build=$taskVersion.CurrentBuild;ubr=$taskVersion.UBR;displayVersion=$taskVersion.DisplayVersion;architecture=$taskOs.OSArchitecture;lastBootUtc=$taskOs.LastBootUpTime.ToUniversalTime().ToString('o')}
 memory=[ordered]@{totalKiB=$taskOs.TotalVisibleMemorySize;freeKiB=$taskOs.FreePhysicalMemory}
 observerPid=$PID
 observerJob=[CivitasJobSnapshot]::Read()
 candidate=[ordered]@{path=$taskCandidate;bytes=(Get-Item -LiteralPath $taskCandidate).Length;sha256=(Get-FileHash -LiteralPath $taskCandidate -Algorithm SHA256).Hash.ToLowerInvariant()}
 electronPackage=(Get-Content -LiteralPath (Join-Path $taskRoot 'node_modules/electron/package.json') -Raw | ConvertFrom-Json).version
 builderPackage=(Get-Content -LiteralPath (Join-Path $taskRoot 'node_modules/electron-builder/package.json') -Raw | ConvertFrom-Json).version
 probeSha256=(Get-FileHash -LiteralPath (Join-Path $taskRoot 'scripts/repro-electron-quit.cjs') -Algorithm SHA256).Hash.ToLowerInvariant()
 harnessSha256=(Get-FileHash -LiteralPath (Join-Path $taskRoot 'scripts/shutdown-closure.ps1') -Algorithm SHA256).Hash.ToLowerInvariant()
}
$taskMachine | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskRoot 'artifacts/shutdown-closure-environment.json') -Encoding utf8
Write-Output ($taskMachine | ConvertTo-Json -Depth 8)

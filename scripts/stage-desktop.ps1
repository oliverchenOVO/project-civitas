$ErrorActionPreference = 'Stop'
$taskWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskRuntime = [IO.Path]::GetFullPath((Join-Path $taskWorkspace '.desktop-runtime'))
if (-not $taskRuntime.StartsWith($taskWorkspace + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Runtime staging must remain inside the CIVITAS workspace.'
}
if (Test-Path -LiteralPath $taskRuntime) { Remove-Item -LiteralPath $taskRuntime -Recurse -Force }
New-Item -ItemType Directory -Path $taskRuntime -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $taskWorkspace 'dist') -Destination $taskRuntime -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $taskRuntime 'apps\desktop') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $taskWorkspace 'apps\desktop\electron') -Destination (Join-Path $taskRuntime 'apps\desktop') -Recurse -Force
$taskMetadata = Get-Content -LiteralPath (Join-Path $taskWorkspace 'package.json') -Raw | ConvertFrom-Json
$taskBuild = $taskMetadata.build
$taskBuild.directories.app = '.'
$taskBuild.directories.output = Join-Path $taskWorkspace $taskMetadata.build.directories.output
$taskBuild.electronDist = Join-Path $taskWorkspace 'node_modules\electron\dist'
$taskElectron = Get-Content -LiteralPath (Join-Path $taskWorkspace 'node_modules\electron\package.json') -Raw | ConvertFrom-Json
$taskBuild | Add-Member -NotePropertyName electronVersion -NotePropertyValue $taskElectron.version -Force
$taskBuild.directories.PSObject.Properties.Remove('app')
@{name=$taskMetadata.name; version=$taskMetadata.version; description=$taskMetadata.description; author=$taskMetadata.author; main=$taskMetadata.main; build=$taskBuild} |
    ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $taskRuntime 'package.json') -Encoding utf8
# pnpm 11 lists every workspace importer, even from a dependency-free staging folder.
# Give the runtime its own empty workspace so the packager cannot collect development libraries.
Set-Content -LiteralPath (Join-Path $taskRuntime 'pnpm-workspace.yaml') -Value 'packages: []' -Encoding utf8
Set-Content -LiteralPath (Join-Path $taskRuntime 'pnpm-lock.yaml') -Value "lockfileVersion: '9.0'`nsettings:`n  autoInstallPeers: true`n  excludeLinksFromLockfile: false`nimporters:`n  .: {}" -Encoding utf8
Write-Output 'Staged bundled renderer and Electron entrypoints without development dependencies.'

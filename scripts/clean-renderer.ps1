$ErrorActionPreference = 'Stop'
$taskWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskDist = [IO.Path]::GetFullPath((Join-Path $taskWorkspace 'dist'))
if ([IO.Path]::GetDirectoryName($taskDist) -ne $taskWorkspace -or [IO.Path]::GetFileName($taskDist) -ne 'dist') {
    throw 'Renderer cleanup must target only the generated CIVITAS dist folder.'
}
if (Test-Path -LiteralPath $taskDist) {
    $taskDirectory = Get-Item -LiteralPath $taskDist
    if ($taskDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Refusing renderer cleanup through a junction or symbolic link.'
    }
    Remove-Item -LiteralPath $taskDist -Recurse -Force
}

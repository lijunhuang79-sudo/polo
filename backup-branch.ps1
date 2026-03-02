# Backup branch script - run with PowerShell to avoid encoding issues
$ErrorActionPreference = "Stop"
cd $PSScriptRoot

$today = Get-Date -Format "yyyyMMdd"
$branch = "backup/$today"

$git = $null
if (Get-Command git -ErrorAction SilentlyContinue) { $git = "git" }
if (-not $git -and (Test-Path "C:\Program Files\Git\bin\git.exe")) { $git = "C:\Program Files\Git\bin\git.exe" }
if (-not $git) { Write-Host "[ERROR] Git not found."; pause; exit 1 }

Write-Host ""
Write-Host "=== Backup branch: $branch ===" -ForegroundColor Cyan
Write-Host ""

& $git checkout -b $branch
if ($LASTEXITCODE -ne 0) {
    Write-Host "Branch $branch may already exist." -ForegroundColor Yellow
    pause
    exit 1
}

& $git add -A
$hasChanges = $false
& $git diff --cached --quiet 2>$null; if ($LASTEXITCODE -ne 0) { $hasChanges = $true }

if ($hasChanges) {
    & $git commit -m "backup: $today"
    Write-Host "Saved to branch: $branch" -ForegroundColor Green
} else {
    & $git commit -m "backup: $today empty" --allow-empty
    Write-Host "Empty backup: $branch" -ForegroundColor Gray
}

& $git checkout main
Write-Host ""
Write-Host "Done. Close this window when ready." -ForegroundColor Green
Write-Host ""
pause

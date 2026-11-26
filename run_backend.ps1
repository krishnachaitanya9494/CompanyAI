# PowerShell launcher script for CompanyAI Backend
param (
    [string]$HostAddress = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$NoReload
)

$ErrorActionPreference = "Stop"

# Set project root
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = (Get-Location).Path
}

# Configure PYTHONPATH to project root
$env:PYTHONPATH = $ProjectRoot

# Determine python executable
$PythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting CompanyAI 2.0 Backend Server                    " -ForegroundColor Cyan
Write-Host " URL: http://${HostAddress}:${Port}                       " -ForegroundColor Green
Write-Host " Project Root: $ProjectRoot                               " -ForegroundColor Gray
Write-Host " Python: $PythonExe                                       " -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

$ReloadFlag = if ($NoReload) { @() } else { @("--reload") }

& $PythonExe -m uvicorn app.main:app --host $HostAddress --port $Port @ReloadFlag

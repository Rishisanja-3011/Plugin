$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location $projectDir

& (Join-Path $PSScriptRoot 'setup-wireless.ps1')

$env:NODE_ENV = 'development'
npx.cmd expo start --lan --port 8081

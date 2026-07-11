param(
  [string]$HostIp,
  [int]$BackendPort = 8091,
  [int]$MetroPort = 8081
)

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location $projectDir

& (Join-Path $PSScriptRoot 'setup-wireless.ps1') -HostIp $HostIp -BackendPort $BackendPort -MetroPort $MetroPort

$buildConfigPath = Join-Path $projectDir 'android\app\build\generated\source\buildConfig\debug\com\plugin\mobile\BuildConfig.java'
if (Test-Path $buildConfigPath) {
  $buildConfig = Get-Content -Path $buildConfigPath -Raw
  if ($buildConfig -notmatch [regex]::Escape("PLUGIN_METRO_HOST = `"$($env:EXPO_PUBLIC_METRO_HOST)`"")) {
    $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
    $connectedDevice = if ($adbCommand) {
      adb devices | Select-String -Pattern '^\S+\s+device$' | Select-Object -First 1
    } else {
      $null
    }

    if ($connectedDevice) {
      Write-Host "The Wi-Fi IP changed. Updating the installed debug APK automatically..."
      & (Join-Path $PSScriptRoot 'install-wireless-debug.ps1') `
        -HostIp $HostIp `
        -BackendPort $BackendPort `
        -MetroPort $MetroPort
    } else {
      Write-Warning "The installed debug APK still points at an old Metro host, so live reload is unavailable. The app will open from its embedded bundle. Connect the phone once and run npm.cmd run wireless again to update it automatically."
    }
  }
}

$env:NODE_ENV = 'development'
$env:EXPO_OFFLINE = '1'
npx.cmd expo start --lan --port $MetroPort

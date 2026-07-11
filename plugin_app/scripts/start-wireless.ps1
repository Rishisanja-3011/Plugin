param(
  [string]$HostIp,
  [int]$BackendPort = 8091,
  [int]$MetroPort = 8081
)

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location $projectDir

& (Join-Path $PSScriptRoot 'setup-wireless.ps1') -HostIp $HostIp -BackendPort $BackendPort -MetroPort $MetroPort

function Set-DeviceMetroHost {
  param([string]$Serial)

  $result = adb -s $Serial shell am broadcast `
    -n 'com.plugin.mobile/.MetroHostReceiver' `
    -a 'com.plugin.mobile.SET_METRO_HOST' `
    --es metroHost $env:EXPO_PUBLIC_METRO_HOST 2>&1
  return ($result -match 'result=-1')
}

$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
$deviceSerials = if ($adbCommand) {
  adb devices | ForEach-Object {
    if ($_ -match '^(\S+)\s+device$') { $Matches[1] }
  }
} else {
  @()
}

if ($deviceSerials.Count -gt 0) {
  $needsOneTimeUpgrade = $false
  foreach ($serial in $deviceSerials) {
    if (-not (Set-DeviceMetroHost -Serial $serial)) {
      $needsOneTimeUpgrade = $true
      break
    }
  }

  if ($needsOneTimeUpgrade) {
    Write-Host 'Installing the one-time wireless host updater on the Android device...'
    & (Join-Path $PSScriptRoot 'install-wireless-debug.ps1') `
      -HostIp $HostIp `
      -BackendPort $BackendPort `
      -MetroPort $MetroPort

    foreach ($serial in $deviceSerials) {
      if (-not (Set-DeviceMetroHost -Serial $serial)) {
        throw "Could not update the Metro host on Android device $serial after installation."
      }
    }
  }

  Write-Host "Android Metro host updated at runtime; APK rebuild is not needed when the Wi-Fi IP changes."
} else {
  Write-Host 'No ADB device is connected. Metro will still start; the app keeps its last host until wireless ADB reconnects.'
}

$env:NODE_ENV = 'development'
$env:EXPO_OFFLINE = '1'
npx.cmd expo start --lan --port $MetroPort

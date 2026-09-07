param(
  [string]$HostIp,
  [int]$BackendPort = 8091,
  [int]$MetroPort = 8081,
  [switch]$Usb
)

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
Set-Location $projectDir

function Test-TcpPort {
  param([string]$Address, [int]$Port, [int]$TimeoutMs = 350)

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $connection = $client.BeginConnect($Address, $Port, $null, $null)
    if (-not $connection.AsyncWaitHandle.WaitOne($TimeoutMs)) {
      return $false
    }
    $client.EndConnect($connection)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Get-MetroProjectRoot {
  param([int]$Port)

  try {
    $manifest = Invoke-RestMethod `
      -Uri "http://127.0.0.1:${Port}" `
      -Headers @{ 'expo-platform' = 'android'; 'expo-protocol-version' = '1'; Accept = 'application/json' } `
      -TimeoutSec 2
    return [string]$manifest.extra.expoClient._internal.projectRoot
  } catch {
    return ''
  }
}

function Test-MetroBundle {
  param([int]$Port)

  try {
    $manifest = Invoke-RestMethod `
      -Uri "http://127.0.0.1:${Port}" `
      -Headers @{ 'expo-platform' = 'android'; 'expo-protocol-version' = '1'; Accept = 'application/json' } `
      -TimeoutSec 3
    $bundleUrl = [string]$manifest.launchAsset.url
    if (-not $bundleUrl) { return $false }

    Invoke-WebRequest -Uri $bundleUrl -Method Head -UseBasicParsing -TimeoutSec 45 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Resolve-MetroPort {
  param([int]$PreferredPort)

  $candidate = $PreferredPort
  while ($candidate -le ($PreferredPort + 9)) {
    if (-not (Test-TcpPort -Address '127.0.0.1' -Port $candidate)) {
      return [pscustomobject]@{ Port = $candidate; Reuse = $false }
    }

    $servedRoot = Get-MetroProjectRoot -Port $candidate
    if ($servedRoot -and [IO.Path]::GetFullPath($servedRoot) -eq [IO.Path]::GetFullPath($projectDir)) {
      if (Test-MetroBundle -Port $candidate) {
        return [pscustomobject]@{ Port = $candidate; Reuse = $true }
      }
      Write-Warning "Metro on port $candidate belongs to this project but is not serving bundles. Trying another port."
    }
    $candidate++
  }
  throw "Ports $PreferredPort-$($PreferredPort + 9) are already in use. Stop an old Metro process and retry."
}

$metro = Resolve-MetroPort -PreferredPort $MetroPort
$MetroPort = $metro.Port
if ($Usb) {
  $HostIp = '127.0.0.1'
}

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
  foreach ($serial in $deviceSerials) {
    if ($Usb) {
      adb -s $serial reverse "tcp:$MetroPort" "tcp:$MetroPort" | Out-Null
      adb -s $serial reverse "tcp:$BackendPort" "tcp:$BackendPort" | Out-Null
    }
    if (adb -s $serial shell pm path com.plugin.mobile 2>$null) {
      $packageInfo = adb -s $serial shell dumpsys package com.plugin.mobile 2>$null
      if (($packageInfo -match '\bDEBUGGABLE\b') -and -not (Set-DeviceMetroHost -Serial $serial)) {
        Write-Warning "The installed Plugin debug app on $serial is old. Reinstall it with npm.cmd run android:wireless or npm.cmd run android:wired."
      }
    }
  }
} else {
  if ($Usb) {
    throw 'USB mode requires an Android device visible in adb devices.'
  }
  Write-Host 'No ADB device is connected. Scan the Expo Go QR code after Metro starts.'
}

$env:NODE_ENV = 'development'
# Expo Go only needs the local Metro server for this workflow. Prevent a temporary
# Expo service/DNS outage from aborting Metro before the phone can connect.
$env:EXPO_OFFLINE = '1'

if ($metro.Reuse) {
  Write-Host "Reusing the existing Metro server for this project on port $MetroPort."
  foreach ($serial in $deviceSerials) {
    $expoUrl = if ($Usb) { "exp://127.0.0.1:$MetroPort" } else { "exp://$($env:EXPO_PUBLIC_METRO_HOST)" }
    adb -s $serial shell am start -a android.intent.action.VIEW -d $expoUrl | Out-Null
  }
  exit 0
}

if (-not (Test-TcpPort -Address '127.0.0.1' -Port $BackendPort)) {
  Write-Warning "The Plugin backend is not listening on port $BackendPort. The app will open, but API actions need the backend."
}

$connectionFlag = if ($Usb) { '--localhost' } else { '--lan' }
$expoArgs = @('expo', 'start', $connectionFlag, '--go', '--clear', '--port', [string]$MetroPort)
if ($deviceSerials.Count -gt 0) {
  $expoArgs += '--android'
}
& npx.cmd @expoArgs
if ($LASTEXITCODE -ne 0) {
  throw "Expo/Metro exited with code $LASTEXITCODE."
}

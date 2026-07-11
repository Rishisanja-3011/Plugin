param(
  [string]$HostIp,
  [int]$BackendPort = 8091,
  [int]$MetroPort = 8081
)

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectDir '.env'

function Get-LanIPv4 {
  $ipconfig = ipconfig
  $currentAdapter = ''
  $candidates = New-Object System.Collections.Generic.List[object]

  foreach ($line in $ipconfig) {
    if ($line -match 'adapter (.+):$') {
      $currentAdapter = $Matches[1]
      continue
    }
    if ($line -match 'IPv4 Address[.\s]*:\s*([0-9.]+)') {
      $ip = $Matches[1]
      if ($ip -like '127.*' -or $ip -like '169.254.*') {
        continue
      }
      $score = 0
      if ($currentAdapter -match 'Wi-Fi|Wireless|WLAN') { $score += 100 }
      if ($ip -like '192.168.*' -or $ip -like '10.*' -or $ip -match '^172\.(1[6-9]|2[0-9]|3[0-1])\.') { $score += 10 }
      $candidates.Add([pscustomobject]@{ IP = $ip; Adapter = $currentAdapter; Score = $score })
    }
  }

  $best = $candidates | Sort-Object Score -Descending | Select-Object -First 1
  if (-not $best) {
    throw 'Could not find a LAN IPv4 address. Connect this PC to Wi-Fi/hotspot or pass -HostIp manually.'
  }
  return $best.IP
}

if (-not $HostIp) {
  $HostIp = Get-LanIPv4
}

$lanUrl = "http://${HostIp}:${BackendPort}/api"
$metroHost = "${HostIp}:${MetroPort}"
$lines = @()
if (Test-Path $envPath) {
  $lines = Get-Content -Path $envPath
}

$values = [ordered]@{}
foreach ($line in $lines) {
  if ($line -match '^\s*#' -or $line -notmatch '=') {
    continue
  }
  $key, $value = $line -split '=', 2
  $values[$key.Trim()] = $value
}

if (-not $values.Contains('EXPO_PUBLIC_GOOGLE_CLIENT_ID')) {
  $values['EXPO_PUBLIC_GOOGLE_CLIENT_ID'] = '380196336293-ghfo78fd82va3gp0dffren6lk2mqcrg1.apps.googleusercontent.com'
}
if (-not $values.Contains('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID')) {
  $values['EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'] = '380196336293-5i90qr9kni2p8b2oahpukrlgs081lj99.apps.googleusercontent.com'
}

$values['EXPO_PUBLIC_API_BASE_URL'] = ''
$values['EXPO_PUBLIC_API_LAN_BASE_URL'] = $lanUrl
$values['EXPO_PUBLIC_API_PORT'] = [string]$BackendPort
$values['EXPO_PUBLIC_METRO_HOST'] = $metroHost

$env:EXPO_PUBLIC_API_BASE_URL = ''
$env:EXPO_PUBLIC_API_LAN_BASE_URL = $lanUrl
$env:EXPO_PUBLIC_API_PORT = [string]$BackendPort
$env:EXPO_PUBLIC_METRO_HOST = $metroHost
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $HostIp

$output = @(
  "EXPO_PUBLIC_GOOGLE_CLIENT_ID=$($values['EXPO_PUBLIC_GOOGLE_CLIENT_ID'])",
  "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=$($values['EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'])",
  "EXPO_PUBLIC_API_BASE_URL=$($values['EXPO_PUBLIC_API_BASE_URL'])",
  "EXPO_PUBLIC_API_LAN_BASE_URL=$($values['EXPO_PUBLIC_API_LAN_BASE_URL'])",
  "EXPO_PUBLIC_API_PORT=$($values['EXPO_PUBLIC_API_PORT'])",
  "EXPO_PUBLIC_METRO_HOST=$($values['EXPO_PUBLIC_METRO_HOST'])"
)

Set-Content -Path $envPath -Value $output -Encoding utf8

Write-Host "Wireless API URL set to $lanUrl"
Write-Host "Wireless Metro host set to $metroHost"
Write-Host "Keep the Android phone on the same Wi-Fi/hotspot as this PC."

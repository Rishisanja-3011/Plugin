param(
  [string]$HostIp,
  [int]$BackendPort = 8091,
  [switch]$Usb
)

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectDir 'android'
Set-Location $projectDir

if ($Usb) {
  $HostIp = '127.0.0.1'
}

& (Join-Path $PSScriptRoot 'setup-wireless.ps1') `
  -HostIp $HostIp `
  -BackendPort $BackendPort `
  -MetroPort 8081

$deviceSerials = adb devices | ForEach-Object {
  if ($_ -match '^(\S+)\s+device$') { $Matches[1] }
}
if ($deviceSerials.Count -eq 0) {
  $connection = if ($Usb) { 'USB' } else { 'USB once or wireless ADB' }
  throw "No Android device found. Connect with $connection, confirm the debugging prompt, and retry."
}

if ($Usb) {
  foreach ($serial in $deviceSerials) {
    adb -s $serial reverse "tcp:$BackendPort" "tcp:$BackendPort" | Out-Null
  }
}

$deviceArchitectures = $deviceSerials | ForEach-Object {
  (adb -s $_ shell getprop ro.product.cpu.abi).Trim()
} | Where-Object { $_ -match '^(arm64-v8a|armeabi-v7a|x86_64|x86)$' } | Select-Object -Unique
if ($deviceArchitectures.Count -eq 0) {
  $deviceArchitectures = @('arm64-v8a')
}
$architectureProperty = $deviceArchitectures -join ','

$env:NODE_ENV = 'production'
$env:EXPO_PUBLIC_ALLOW_DEV_NETWORKING = 'true'
# Keep native dependency paths below Windows' legacy 260-character limit while
# reusing the developer's existing Gradle distribution and dependency cache.
$env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE '.gradle'

$nativeCacheRoot = [IO.Path]::GetFullPath((Join-Path $androidDir 'app\.cxx'))
$localNativeCache = [IO.Path]::GetFullPath((Join-Path $nativeCacheRoot 'RelWithDebInfo'))
if (-not $localNativeCache.StartsWith($nativeCacheRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Unexpected native cache path: $localNativeCache"
}
if (Test-Path -LiteralPath $localNativeCache) {
  $hasStaleGradlePath = Get-ChildItem -LiteralPath $localNativeCache -Filter 'build.ninja' -File -Recurse `
    | Select-String -SimpleMatch 'plugin-gradle-online-' -Quiet
  if ($hasStaleGradlePath) {
    Write-Host 'Removing the stale generated native build cache...'
    Remove-Item -LiteralPath $localNativeCache -Recurse -Force
  }
}

Push-Location $androidDir
try {
  & .\gradlew.bat :app:installLocal "-PreactNativeArchitectures=$architectureProperty"
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle installLocal failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}

foreach ($serial in $deviceSerials) {
  adb -s $serial shell am force-stop com.plugin.mobile | Out-Null
  adb -s $serial shell am start -n com.plugin.mobile/.MainActivity | Out-Null
}

$mode = if ($Usb) { 'USB/adb reverse' } else { "wireless LAN ($env:EXPO_PUBLIC_API_LAN_BASE_URL)" }
Write-Host "Self-contained Plugin APK installed and launched using $mode."
Write-Host 'Metro is not required for this APK. Rebuild only when app code or the Wi-Fi IP changes.'

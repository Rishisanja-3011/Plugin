param(
  [string]$HostIp,
  [int]$BackendPort = 8091,
  [int]$MetroPort = 8081,
  [switch]$Launch
)

$ErrorActionPreference = 'Stop'

$projectDir = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $projectDir 'android'
Set-Location $projectDir
$env:NODE_ENV = 'production'

& (Join-Path $PSScriptRoot 'setup-wireless.ps1') -HostIp $HostIp -BackendPort $BackendPort -MetroPort $MetroPort

$adbDevices = adb devices
$connectedDevice = $adbDevices | Select-String -Pattern '^\S+\s+device$' | Select-Object -First 1
if (-not $connectedDevice) {
  throw 'No Android device found by adb. Connect the phone by USB once, enable USB debugging, then rerun npm.cmd run android:wireless.'
}

Push-Location $androidDir
try {
  & .\gradlew.bat :app:installDebug
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle installDebug failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}

if ($Launch) {
  adb shell am force-stop com.plugin.mobile
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to stop com.plugin.mobile on the Android device. adb exited with code $LASTEXITCODE."
  }
  adb shell monkey -p com.plugin.mobile 1
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to launch com.plugin.mobile on the Android device. adb exited with code $LASTEXITCODE."
  }
}

Write-Host 'Self-contained debug APK installed with runtime wireless host support.'
Write-Host 'The app opens from its embedded bundle on any network. For live reload, start Metro with: npm.cmd run wireless'

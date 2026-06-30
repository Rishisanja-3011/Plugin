$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $scriptDir
$apkPath = Join-Path $scriptDir 'app\build\outputs\apk\release\app-release.apk'

& (Join-Path $scriptDir 'build-release-offline.ps1')

if (-not (Test-Path $apkPath)) {
  throw "Release APK not found at $apkPath"
}

adb devices
adb install -r $apkPath
adb reverse tcp:8091 tcp:8091
adb shell am force-stop com.plugin.mobile
adb shell monkey -p com.plugin.mobile 1

Write-Host "Plugin app updated from $apkPath"

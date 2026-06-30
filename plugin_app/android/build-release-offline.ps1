$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$gradleHome = Join-Path $env:TEMP 'plugin-gradle-home'
$userGradle = Join-Path $env:USERPROFILE '.gradle'
$jdkHome = Join-Path $userGradle 'jdks\eclipse_adoptium-17-amd64-windows.2'

if (-not (Test-Path (Join-Path $jdkHome 'bin\java.exe'))) {
  throw "Java 17 was not found at $jdkHome. Run one normal Gradle build once, or install JDK 17."
}

$wrapperCache = Join-Path $gradleHome 'wrapper\dists'
$userWrapperCache = Join-Path $userGradle 'wrapper\dists\gradle-8.14.3-bin'
if (-not (Test-Path (Join-Path $wrapperCache 'gradle-8.14.3-bin'))) {
  New-Item -ItemType Directory -Force -Path $wrapperCache | Out-Null
  Copy-Item -LiteralPath $userWrapperCache -Destination $wrapperCache -Recurse -Force
}

$cacheHome = Join-Path $gradleHome 'caches'
$userCacheHome = Join-Path $userGradle 'caches'
foreach ($cacheName in @('modules-2', 'jars-9')) {
  $target = Join-Path $cacheHome $cacheName
  if (-not (Test-Path $target)) {
    New-Item -ItemType Directory -Force -Path $cacheHome | Out-Null
    Copy-Item -LiteralPath (Join-Path $userCacheHome $cacheName) -Destination $cacheHome -Recurse -Force
  }
}

$env:NODE_ENV = 'production'
$env:JAVA_HOME = $jdkHome
$env:PATH = "$jdkHome\bin;$env:PATH"
$env:GRADLE_USER_HOME = $gradleHome

Push-Location $scriptDir
try {
  & (Join-Path $scriptDir 'gradlew.bat') assembleRelease --offline --no-daemon --no-parallel `
    "-Dorg.gradle.java.installations.auto-download=false" `
    "-Dorg.gradle.java.installations.paths=$jdkHome" `
    "-Dkotlin.compiler.execution.strategy=in-process"
} finally {
  Pop-Location
}

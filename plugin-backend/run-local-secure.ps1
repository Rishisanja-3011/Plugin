param(
    [string]$EnvFile = '',
    [switch]$UseBuiltArtifact
)

$ErrorActionPreference = 'Stop'

function Import-PluginEnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    $resolvedPath = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
    foreach ($rawLine in Get-Content -LiteralPath $resolvedPath) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
            continue
        }
        if ($line.StartsWith('export ', [StringComparison]::OrdinalIgnoreCase)) {
            $line = $line.Substring(7).Trim()
        }
        if ($line -notmatch '^(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.*)$') {
            continue
        }
        $name = $Matches['name']
        $value = $Matches['value'].Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        Set-Item -Path "Env:$name" -Value $value
    }
    Write-Host "Loaded backend environment from $resolvedPath"
}

$localEnvPath = Join-Path $PSScriptRoot '.env'
if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
    Import-PluginEnvFile -Path $EnvFile
} elseif (Test-Path -LiteralPath $localEnvPath -PathType Leaf) {
    Import-PluginEnvFile -Path $localEnvPath
    if (-not [string]::IsNullOrWhiteSpace($env:PLUGIN_ENV_IMPORT)) {
        Import-PluginEnvFile -Path $env:PLUGIN_ENV_IMPORT
    }
}

function Get-PluginJavaMajorVersion {
    param([Parameter(Mandatory = $true)][string]$JavaHome)

    $javaExecutable = Join-Path $JavaHome 'bin\java.exe'
    if (-not (Test-Path -LiteralPath $javaExecutable -PathType Leaf)) {
        return $null
    }

    # Windows PowerShell surfaces java -version (written to stderr) as a
    # NativeCommandError when the script-wide preference is Stop.
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $versionOutput = (& $javaExecutable -version 2>&1 | Out-String)
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    if ($versionOutput -match 'version\s+"(?:1\.)?(?<major>\d+)') {
        return [int]$Matches['major']
    }

    return $null
}

function Set-PluginCompatibleJavaHome {
    $currentMajor = $null
    if (-not [string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
        $currentMajor = Get-PluginJavaMajorVersion -JavaHome $env:JAVA_HOME
    }
    if ($currentMajor -eq 17) {
        return
    }

    $candidateHomes = @()
    $bundledJdkRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'tmp\temurin17'
    if (Test-Path -LiteralPath $bundledJdkRoot) {
        $candidateHomes += @(Get-ChildItem -LiteralPath $bundledJdkRoot -Directory | Select-Object -ExpandProperty FullName)
    }
    Get-Command javac.exe -All -ErrorAction SilentlyContinue | ForEach-Object {
        $binDirectory = Split-Path -Parent $_.Source
        if ((Split-Path -Leaf $binDirectory) -ieq 'bin') {
            $candidateHomes += Split-Path -Parent $binDirectory
        }
    }

    @(
        (Join-Path $env:ProgramFiles 'Java'),
        (Join-Path $env:ProgramFiles 'Eclipse Adoptium'),
        (Join-Path $env:ProgramFiles 'Microsoft')
    ) | Where-Object { Test-Path -LiteralPath $_ -PathType Container } | ForEach-Object {
        Get-ChildItem -LiteralPath $_ -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $candidateHomes += $_.FullName
        }
    }

    $compatibleJava = $candidateHomes |
        Select-Object -Unique |
        ForEach-Object {
            $major = Get-PluginJavaMajorVersion -JavaHome $_
            if ($major -eq 17) {
                [PSCustomObject]@{ Home = $_; Major = $major }
            }
        } |
        Sort-Object Major -Descending |
        Select-Object -First 1

    if ($null -eq $compatibleJava) {
        throw 'Java 17 is required to match the tested build. Install JDK 17 and set JAVA_HOME to its directory.'
    }

    $env:JAVA_HOME = $compatibleJava.Home
    Write-Host "Using Java $($compatibleJava.Major) from $($compatibleJava.Home)"
}

function New-PluginLocalSecret {
    $bytes = New-Object byte[] 48
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }
    return [Convert]::ToBase64String($bytes)
}

function Get-PluginDotEnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return ''
    }

    $prefix = "$Name="
    $line = Get-Content -LiteralPath $Path |
        Where-Object { $_.TrimStart().StartsWith($prefix, [StringComparison]::Ordinal) } |
        Select-Object -Last 1
    if ($null -eq $line) {
        return ''
    }
    return $line.Trim().Substring($prefix.Length).Trim().Trim('"').Trim("'")
}

# These values live only in this process tree and are regenerated for every
# local run. Production must supply stable, independently generated secrets.
if ([string]::IsNullOrWhiteSpace($env:JWT_SECRET)) {
    $env:JWT_SECRET = New-PluginLocalSecret
}
if ([string]::IsNullOrWhiteSpace($env:OTP_PEPPER)) {
    $env:OTP_PEPPER = New-PluginLocalSecret
}
if ([string]::IsNullOrWhiteSpace($env:RATE_LIMIT_PEPPER)) {
    $env:RATE_LIMIT_PEPPER = New-PluginLocalSecret
}
if ([string]::IsNullOrWhiteSpace($env:GOOGLE_CLIENT_IDS)) {
    $mobileEnvPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'plugin_app\.env'
    $googleClientIds = @(
        Get-PluginDotEnvValue -Path $mobileEnvPath -Name 'EXPO_PUBLIC_GOOGLE_CLIENT_ID'
        Get-PluginDotEnvValue -Path $mobileEnvPath -Name 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'
    ) | Where-Object {
        $_ -match '^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$'
    } | Select-Object -Unique

    if ($googleClientIds.Count -gt 0) {
        $env:GOOGLE_CLIENT_IDS = $googleClientIds -join ','
    }
}

Set-PluginCompatibleJavaHome

Set-Location -LiteralPath $PSScriptRoot
$backendPort = if ($env:SERVER_PORT) { [int]$env:SERVER_PORT } else { 8091 }
$existingListener = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingListener) {
    $existingProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($existingListener.OwningProcess)"
    $parentProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($existingProcess.ParentProcessId)" -ErrorAction SilentlyContinue
    if (($existingProcess.CommandLine -like '*com.plugin.PluginApplication*' -or $existingProcess.CommandLine -like '*plugin-runtime-*.jar*') -and
        ($existingProcess.CommandLine -like "*$PSScriptRoot*" -or $parentProcess.CommandLine -like "*$PSScriptRoot*")) {
        Write-Host "PLUGIN backend is already running at http://localhost:$backendPort (PID $($existingListener.OwningProcess))."
        Write-Host 'Web app: http://localhost:5173. Stop the existing backend before restarting with changed backend code.'
        exit 0
    }
    throw "Port $backendPort is occupied by PID $($existingListener.OwningProcess). No process was stopped; verify the owner before restarting."
}

$mavenCommand = Get-Command mvn.cmd -ErrorAction SilentlyContinue
if ($null -eq $mavenCommand) {
    $localMaven = Join-Path (Split-Path -Parent $PSScriptRoot) 'tmp\maven-3.9.11\apache-maven-3.9.11\bin\mvn.cmd'
    if (Test-Path -LiteralPath $localMaven -PathType Leaf) {
        $mavenExecutable = $localMaven
    } else {
        throw 'Maven was not found. Install Maven 3.8+ or add mvn.cmd to PATH.'
    }
} else {
    $mavenExecutable = $mavenCommand.Source
}

if (-not $UseBuiltArtifact) {
    if ([string]::IsNullOrWhiteSpace($env:MAVEN_OPTS)) {
        $env:MAVEN_OPTS = '-Xmx256m -XX:+UseSerialGC -XX:ActiveProcessorCount=2'
    }
    & $mavenExecutable package '-DskipTests' -q
    if ($LASTEXITCODE -ne 0) { throw 'Backend packaging failed. No server was started.' }
}
$builtJar = Join-Path $PSScriptRoot 'target\plugin-backend-1.0.0.jar'
if (-not (Test-Path -LiteralPath $builtJar -PathType Leaf)) { throw 'Build the backend before using -UseBuiltArtifact.' }
# An immutable runtime copy avoids class-not-found failures when Maven recompiles
# target/classes or replaces build artifacts while the local server is serving requests.
$runtimeDirectory = Join-Path $PSScriptRoot '.local-runtime'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$runtimeJar = Join-Path $runtimeDirectory ('plugin-runtime-' + [guid]::NewGuid().ToString('N') + '.jar')
Copy-Item -LiteralPath $builtJar -Destination $runtimeJar
& (Join-Path $env:JAVA_HOME 'bin\java.exe') '-Xmx256m' '-XX:+UseSerialGC' '-XX:ActiveProcessorCount=2' '-XX:TieredStopAtLevel=1' '-XX:ReservedCodeCacheSize=48m' -jar $runtimeJar
exit $LASTEXITCODE

$ErrorActionPreference = 'Stop'

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
    if ($null -ne $currentMajor -and $currentMajor -ge 17) {
        return
    }

    $candidateHomes = @()
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
            if ($null -ne $major -and $major -ge 17) {
                [PSCustomObject]@{ Home = $_; Major = $major }
            }
        } |
        Sort-Object Major -Descending |
        Select-Object -First 1

    if ($null -eq $compatibleJava) {
        throw 'Java 17 or newer is required. Install a JDK 17+ and set JAVA_HOME to its installation directory.'
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

& mvn.cmd spring-boot:run
exit $LASTEXITCODE


$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$javaHomeCandidates = @()
foreach ($variableName in @("JAVA_HOME_21_X64", "JAVA_HOME")) {
    $candidate = [Environment]::GetEnvironmentVariable($variableName, "Process")
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
        $javaHomeCandidates += $candidate
    }
}

$programFiles = [Environment]::GetFolderPath("ProgramFiles")
foreach ($pattern in @("Java\jdk-21*", "Eclipse Adoptium\jdk-21*", "Microsoft\jdk-21*")) {
    $searchPath = Join-Path $programFiles $pattern
    $javaHomeCandidates += Get-ChildItem -Path $searchPath -Directory -ErrorAction SilentlyContinue |
        ForEach-Object { $_.FullName }
}

$javaHome = $null
foreach ($candidate in ($javaHomeCandidates | Select-Object -Unique)) {
    $releaseFile = Join-Path $candidate "release"
    if (Test-Path $releaseFile) {
        $versionLine = Get-Content $releaseFile |
            Where-Object { $_ -match '^JAVA_VERSION="21(?:\.|")' } |
            Select-Object -First 1
        if ($versionLine) {
            $javaHome = $candidate
            break
        }
    }
}

if (-not $javaHome) {
    throw "Java 21 JDK not found. Set JAVA_HOME to a Java 21 installation before running this script."
}

$env:JAVA_HOME = $javaHome
$env:PATH = "$(Join-Path $javaHome 'bin');$env:PATH"
Write-Host "Using Java 21 from $javaHome"

$envFile = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envFile)) {
    throw ".env file not found: $envFile"
}

# Load KEY=VALUE lines into this PowerShell process.
foreach ($line in Get-Content $envFile) {
    $line = $line.Trim()

    if (-not $line -or $line.StartsWith("#")) {
        continue
    }

    if ($line -notmatch '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        throw "Invalid .env line: $line"
    }

    $name = $Matches[1]
    $value = $Matches[2].Trim()

    # Remove optional matching surrounding quotes.
    if ($value.Length -ge 2) {
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
    }

    [Environment]::SetEnvironmentVariable(
        $name, $value, "Process"
    )
}

# Fail early if required values are missing or placeholders remain.
$required = @(
    "DB_PASSWORD",
    "DEMO_CUSTOMER_PASSWORD",
    "DEMO_ANALYST_PASSWORD",
    "DEMO_SUPERVISOR_PASSWORD",
    "DEMO_ADMIN_PASSWORD",
    "KYC_STORAGE_KEY"
)

foreach ($name in $required) {
    $value = [Environment]::GetEnvironmentVariable($name, "Process")

    if ([string]::IsNullOrWhiteSpace($value) -or
        $value.StartsWith("replace_with_") -or
        $value -eq "REPLACE_WITH_GENERATED_BASE64_KEY") {
        throw "Set a real value for $name in your .env file."
    }
}

Write-Host "Environment variables loaded."
Write-Host "Starting Spring Boot..."

mvn spring-boot:run

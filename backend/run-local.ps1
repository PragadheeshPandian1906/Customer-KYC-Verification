
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

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

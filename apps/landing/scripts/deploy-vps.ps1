param(
    [string]$SshHost = 'your-vps-host',
    [string]$RemoteDir = '/var/www/your-site',
    [string]$RemoteArchive = '/tmp/koma-landing-deploy.tar',
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$OutDir = Join-Path $ProjectDir 'out'
$PackageJson = Join-Path $ProjectDir 'package.json'

function Invoke-Step {
    param(
        [string]$Message,
        [scriptblock]$Action
    )

    Write-Host "[INFO] $Message"
    & $Action
}

try {
    if (-not (Test-Path $PackageJson)) {
        throw "package.json not found at $ProjectDir"
    }

    if (-not $SkipBuild) {
        Invoke-Step 'Building koma-landing (npm run build)...' {
            npm run build
        }
    }

    if (-not (Test-Path $OutDir)) {
        throw "Build directory not found: $OutDir"
    }

    $TempArchive = Join-Path $env:TEMP ('koma-landing-' + [guid]::NewGuid().ToString('N') + '.tar')

    try {
        Invoke-Step 'Creating temporary TAR archive of the exported build...' {
            & tar.exe -cf $TempArchive -C $OutDir .
        }

        if (-not (Test-Path $TempArchive)) {
            throw "Failed to create temporary archive: $TempArchive"
        }

        Invoke-Step "Uploading build to $SshHost..." {
            & scp.exe $TempArchive "${SshHost}:$RemoteArchive"
        }

        Invoke-Step 'Publishing build on the VPS...' {
            & ssh.exe $SshHost "sudo rm -rf '$RemoteDir' && sudo mkdir -p '$RemoteDir' && sudo tar -xf '$RemoteArchive' -C '$RemoteDir' && sudo chown -R www-data:www-data '$RemoteDir' && sudo rm -f '$RemoteArchive'"
        }

        Invoke-Step 'Validating site on the VPS local host...' {
            & ssh.exe $SshHost "curl -I -sS http://127.0.0.1/ | sed -n '1,20p'"
        }

        Write-Host '[OK] koma-landing deploy completed.'
    }
    finally {
        if (Test-Path $TempArchive) {
            Remove-Item $TempArchive -Force
        }
    }
}
catch {
    Write-Error $_
    exit 1
}

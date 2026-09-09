param(
  [Parameter(Mandatory = $true)]
  [string] $File
)

$ErrorActionPreference = "Stop"

function Test-Truthy {
  param([string] $Value)
  return $Value -match "^(1|true|yes)$"
}

function Resolve-SignTool {
  if ($env:SIGNTOOL_PATH -and (Test-Path -LiteralPath $env:SIGNTOOL_PATH)) {
    return $env:SIGNTOOL_PATH
  }

  $kitsRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
  if (Test-Path -LiteralPath $kitsRoot) {
    $candidate = Get-ChildItem -LiteralPath $kitsRoot -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($candidate) {
      return $candidate.FullName
    }
  }

  $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "signtool.exe not found. Install Windows SDK or set SIGNTOOL_PATH."
}

function Resolve-CscPfx {
  if (-not $env:CSC_LINK) {
    return $null
  }

  if (Test-Path -LiteralPath $env:CSC_LINK) {
    return (Resolve-Path -LiteralPath $env:CSC_LINK).Path
  }

  if ($env:CSC_LINK -match "^https?://") {
    $tempPfx = Join-Path ([System.IO.Path]::GetTempPath()) "koma-codesign.pfx"
    Invoke-WebRequest -Uri $env:CSC_LINK -OutFile $tempPfx
    return $tempPfx
  }

  $base64 = $env:CSC_LINK
  if ($base64 -match "^data:.*?;base64,") {
    $base64 = $base64 -replace "^data:.*?;base64,", ""
  }

  try {
    $bytes = [Convert]::FromBase64String($base64)
    $tempPfx = Join-Path ([System.IO.Path]::GetTempPath()) "koma-codesign.pfx"
    [System.IO.File]::WriteAllBytes($tempPfx, $bytes)
    return $tempPfx
  } catch {
    throw "CSC_LINK is neither a file path, URL, nor valid base64 PFX."
  }
}

if (-not (Test-Path -LiteralPath $File)) {
  throw "File to sign not found: $File"
}

if (Test-Truthy $env:KOMA_CODESIGN_SKIP) {
  Write-Host "[sign-windows] KOMA_CODESIGN_SKIP enabled; leaving unsigned: $File"
  exit 0
}

$signtool = Resolve-SignTool
$timestampUrl = if ($env:KOMA_TIMESTAMP_URL) { $env:KOMA_TIMESTAMP_URL } else { "http://timestamp.digicert.com" }
$thumbprint = if ($env:KOMA_WINDOWS_CERT_THUMBPRINT) { $env:KOMA_WINDOWS_CERT_THUMBPRINT } else { $env:WINDOWS_CERTIFICATE_THUMBPRINT }

$args = @("sign", "/fd", "SHA256", "/td", "SHA256", "/tr", $timestampUrl)

if ($thumbprint) {
  $args += @("/sha1", $thumbprint)
} else {
  $pfx = Resolve-CscPfx
  if (-not $pfx) {
    throw "No Windows code signing certificate configured. Set KOMA_WINDOWS_CERT_THUMBPRINT or CSC_LINK/CSC_KEY_PASSWORD."
  }

  $args += @("/f", $pfx)
  if ($env:CSC_KEY_PASSWORD) {
    $args += @("/p", $env:CSC_KEY_PASSWORD)
  }
}

$args += $File
& $signtool @args
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

#!/usr/bin/env bash
# Print the CHANGELOG.md section of the version carried by
# apps/electron/package.json.
set -euo pipefail

version=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' apps/electron/package.json | head -1)
[ -n "$version" ] || { echo "cannot read the version from apps/electron/package.json" >&2; exit 1; }

grep -qF "## [$version]" CHANGELOG.md \
  || { echo "CHANGELOG.md has no section for $version" >&2; exit 1; }

awk -v ver="$version" '
  $0 == "## [" ver "]" { print; found = 1; next }
  found && /^## \[/ { exit }
  found { print }
' CHANGELOG.md

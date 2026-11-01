#!/usr/bin/env bash
# Verify a published KOMA Studio release end to end. Usage: verify_release.sh X.Y.Z
set -euo pipefail

version="${1:?usage: verify_release.sh X.Y.Z}"
tag="v${version}"

pass() { printf 'PASS: %s\n' "$1"; }
die()  { printf 'FAIL: %s\n' "$1" >&2; exit 1; }

git rev-parse -q --verify "refs/tags/${tag}" >/dev/null \
  || die "local tag ${tag} does not exist"
pass "local tag ${tag} exists (commit $(git rev-parse --short "${tag}^{commit}"))"

git show "${tag}:apps/electron/package.json" | grep -q "\"version\": \"${version}\"" \
  || die "apps/electron/package.json at the tag does not carry ${version}"
pass "apps/electron/package.json at the tag carries ${version}"

grep -qF "## [${version}]" CHANGELOG.md \
  || die "CHANGELOG.md has no [${version}] section"
pass "CHANGELOG.md has a [${version}] section"

remote=$(git ls-remote origin "refs/tags/${tag}" | awk 'NR == 1 { print $1 }')
[ -n "$remote" ] || die "tag ${tag} does not exist on origin"
pass "tag ${tag} exists on origin"

local_oid=$(git rev-parse "${tag}")
[ "$local_oid" = "$remote" ] \
  || die "local tag ${tag} ($(git rev-parse --short "$local_oid")) differs from origin ($(git rev-parse --short "$remote"))"
pass "local and origin tags match"

git fetch origin --quiet
git merge-base --is-ancestor "${tag}^{196}" origin/main \
  || die "the tag commit is not on origin/main"
pass "tag commit is on origin/main"

info=$(gh release view "${tag}" --json name,isDraft,isPrerelease,targetOid \
  -q '"GitHub release " + .name + " (draft=" + (.isDraft|tostring) + ", prerelease=" + (.isPrerelease|tostring) + ", target " + .targetOid[0:7] + ")"') \
  || die "GitHub release ${tag} not found or still a draft"
pass "$info"

assets=$(gh release view "${tag}" --json assets -q '[.assets[].name] | join(", ")')
if [ -n "$assets" ]; then
  pass "release assets: ${assets}"
else
  pass "no binary assets (GitHub source archives only)"
fi

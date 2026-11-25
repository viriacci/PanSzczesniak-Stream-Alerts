#!/usr/bin/env bash
set -euo pipefail
version="$(node -p "require('./package.json').version")"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+-(beta|rc)\.[0-9]+$ ]]; then
  echo "Not a beta/RC version; skipping publication."
  exit 0
fi
[[ "$GITHUB_REF" == "refs/heads/develop/v2" ]]
tag="v$version"
exe="PSSA-Setup-$version-x64.exe"
dir="release-package"
test -f "$dir/$exe"
test -f "$dir/SHA256SUMS.txt"
expected="$(awk -v file="$exe" '$2==file {print tolower($1)}' "$dir/SHA256SUMS.txt")"
[[ "$expected" =~ ^[0-9a-f]{64}$ ]]
actual="$(sha256sum "$dir/$exe" | cut -d' ' -f1)"
[[ "$actual" == "$expected" ]]
printf '%s  %s\n' "$actual" "$exe" > "$dir/SHA256SUMS.txt"
if gh release view "$tag" --repo "$GITHUB_REPOSITORY" --json isDraft,isPrerelease,assets > existing-release.json 2> release-error.txt; then
  if jq -e --arg exe "$exe" '.isPrerelease and (.isDraft|not) and ([.assets[].name]|index($exe)!=null) and ([.assets[].name]|index("SHA256SUMS.txt")!=null)' existing-release.json >/dev/null; then
    echo "Already published: $tag. Increment the version for further fixes."
    exit 0
  fi
  echo "Existing draft or incomplete release; refusing to overwrite."
  exit 1
fi
notes="docs/releases/$version.md"
if [[ ! -s "$notes" ]]; then
  printf 'Wydanie testowe PSSA %s. Wszystkie testy CI przeszły pomyślnie.\n\nKompilacja: https://github.com/%s/actions/runs/%s\n' "$version" "$GITHUB_REPOSITORY" "$GITHUB_RUN_ID" > release-notes.md
  notes=release-notes.md
fi
gh release create "$tag" "$dir/$exe" "$dir/SHA256SUMS.txt" \
  --repo "$GITHUB_REPOSITORY" --target "$GITHUB_SHA" \
  --title "PSSA $version" --notes-file "$notes" --prerelease --draft --latest=false
gh release view "$tag" --repo "$GITHUB_REPOSITORY" --json isDraft,isPrerelease,assets > draft-release.json
jq -e --arg exe "$exe" '.isDraft and .isPrerelease and ([.assets[].name]|index($exe)!=null) and ([.assets[].name]|index("SHA256SUMS.txt")!=null)' draft-release.json >/dev/null
gh api "repos/$GITHUB_REPOSITORY/releases/tags/$tag" > release-api.json
jq -e --arg exe "$exe" --arg digest "sha256:$actual" 'any(.assets[]; .name==$exe and .digest==$digest and .size>0)' release-api.json >/dev/null
gh release edit "$tag" --repo "$GITHUB_REPOSITORY" --draft=false --prerelease --latest=false
gh release view "$tag" --repo "$GITHUB_REPOSITORY" --json isDraft,isPrerelease,url

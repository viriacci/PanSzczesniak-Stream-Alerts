#!/usr/bin/env bash
set -euo pipefail
version="$(node -p "require('./package.json').version")"
[[ "$version" == "2.0.2" && "$GITHUB_REF" == "refs/heads/develop/v2" ]]
[[ "$(git rev-parse HEAD)" == "$GITHUB_SHA" ]]
tag="v$version"
exe="PSSA-Setup-$version-x64.exe"
dir="release-package"
repo="$GITHUB_REPOSITORY"
expected="$(awk -v file="$exe" '{sub(/\r$/, "", $2)} $2==file {print tolower($1)}' "$dir/SHA256SUMS.txt")"
[[ "$expected" =~ ^[0-9a-f]{64}$ ]]
actual="$(sha256sum "$dir/$exe" | cut -d' ' -f1)"
[[ "$actual" == "$expected" ]]
printf '%s  %s\n' "$actual" "$exe" > "$dir/SHA256SUMS.txt"
sumdigest="$(sha256sum "$dir/SHA256SUMS.txt" | cut -d' ' -f1)"
tree="$(git rev-parse HEAD^{tree})"
main="$(gh api "repos/$repo/git/ref/heads/main" --jq .object.sha)"
main_tree="$(gh api "repos/$repo/git/commits/$main" --jq .tree.sha)"
[[ "$main" == "$EXPECTED_MAIN" || "$main_tree" == "$tree" ]]
legacy="$(gh api "repos/$repo/git/ref/heads/legacy/python" --jq .object.sha)"
[[ "$legacy" == "c0458a1412cc6c5a753bf84779e3d33753553d3a" ]]
[[ "$(gh api "repos/$repo/git/ref/heads/develop/v2" --jq .object.sha)" == "$GITHUB_SHA" ]]
if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  echo "Release already exists; refusing to overwrite."
  exit 1
fi
if gh api "repos/$repo/git/ref/tags/$tag" > existing-tag.json 2>/dev/null; then
  jq -e --arg sha "$GITHUB_SHA" '.object.type=="commit" and .object.sha==$sha' existing-tag.json >/dev/null
else
  gh api --method POST "repos/$repo/git/refs" -f ref="refs/tags/$tag" -f sha="$GITHUB_SHA" >/dev/null
fi
gh release create "$tag" "$dir/$exe" "$dir/SHA256SUMS.txt" \
  --repo "$repo" --verify-tag --title "PSSA $version" \
  --notes-file "docs/releases/$version.md" --draft --latest=false
gh api --paginate "repos/$repo/releases?per_page=100" | jq -s --arg tag "$tag" '[.[][] | select(.tag_name==$tag and .draft==true)] | if length==1 then .[0] else error("Draft not uniquely found") end' > release-api.json
jq -e --arg exe "$exe" --arg digest "sha256:$actual" --arg sumdigest "sha256:$sumdigest" \
  '(.prerelease|not) and any(.assets[]; .name==$exe and .digest==$digest and .size>0) and any(.assets[]; .name=="SHA256SUMS.txt" and .digest==$sumdigest and .size>0)' release-api.json >/dev/null
if [[ "$main_tree" != "$tree" ]]; then
  [[ "$(gh api "repos/$repo/git/ref/heads/main" --jq .object.sha)" == "$main" ]]
  jq -n --arg tree "$tree" --arg first "$main" --arg second "$GITHUB_SHA" \
    '{message:"Release PSSA 2.0.2",tree:$tree,parents:[$first,$second]}' > promote.json
  merge="$(gh api --method POST "repos/$repo/git/commits" --input promote.json --jq .sha)"
  gh api --method PATCH "repos/$repo/git/refs/heads/main" -f sha="$merge" -F force=false >/dev/null
  [[ "$(gh api "repos/$repo/git/ref/heads/main" --jq .object.sha)" == "$merge" ]]
fi
gh release edit "$tag" --repo "$repo" --draft=false --latest=true
gh release view "$tag" --repo "$repo" --json isDraft,isPrerelease,url | tee published-release.json
jq -e '(.isDraft|not) and (.isPrerelease|not)' published-release.json >/dev/null

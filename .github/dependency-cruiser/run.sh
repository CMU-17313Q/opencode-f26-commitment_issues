#!/usr/bin/env bash
# Runs dependency-cruiser (rules in .dependency-cruiser.cjs) on packages/app and packages/opencode.
#
#   bash .github/dependency-cruiser/run.sh            # check: fail on violations not in the baselines
#   bash .github/dependency-cruiser/run.sh baseline   # rewrite the baselines (known-violations.*.json)
#
# depcruise runs from inside each package so that package's `@/*` tsconfig alias resolves.
# Reports go to $OUT (default node_modules/.cache/depcruise): <pkg>.json, <pkg>.md, <pkg>.html.
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$dir/../.." && pwd)"
bin="$root/node_modules/.bin"
out="${OUT:-$root/node_modules/.cache/depcruise}"
mode="${1:-check}"
mkdir -p "$out"

status=0
for pkg in app opencode; do
  cd "$root/packages/$pkg"
  known="$dir/known-violations.$pkg.json"
  args=(src --config "$root/.dependency-cruiser.cjs" --ts-config "$PWD/tsconfig.json")

  if [ "$mode" = "baseline" ]; then
    "$bin/depcruise" "${args[@]}" --baseline "$known"
    echo "$pkg: wrote $(jq length "$known") known violations to ${known#"$root/"}"
    continue
  fi

  echo "::group::dependency-cruiser packages/$pkg"
  "$bin/depcruise" "${args[@]}" --ignore-known "$known" --output-type json --output-to "$out/$pkg.json"
  "$bin/depcruise-fmt" -T markdown -f "$out/$pkg.md" "$out/$pkg.json"
  "$bin/depcruise-fmt" -T err-html -f "$out/$pkg.html" "$out/$pkg.json"
  "$bin/depcruise-fmt" -T err-long -e "$out/$pkg.json" || status=1
  echo "::endgroup::"
  jq -r --arg pkg "$pkg" \
    '.summary | ([.violations[] | .rule.severity] | map(select(. == "error")) | length) as $e
      | ([.violations[] | .rule.severity] | map(select(. == "warn")) | length) as $w
      | "packages/\($pkg): \(.totalCruised) modules, \(.totalDependenciesCruised) dependencies, \($e) new error violations (a cycle counts once), \($w) warnings"' \
    "$out/$pkg.json"
done
exit "$status"

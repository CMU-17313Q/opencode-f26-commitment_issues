#!/usr/bin/env bash
# Tests the rules in .dependency-cruiser.cjs against the small fixture tree in testdata/.
# Each fixture file is one case: a violation the rules must catch, or a pattern they must allow.
#
# Run from anywhere: bash .github/dependency-cruiser/test-rules.sh
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$dir/../.." && pwd)"
cd "$dir/testdata"
out="$("$root/node_modules/.bin/depcruise" src --config "$root/.dependency-cruiser.cjs" \
  --ts-config "$PWD/tsconfig.json" --output-type json)"

fails=0
check() {
  if jq -e "$2" <<< "$out" > /dev/null; then
    echo "PASS  $1"
  else
    echo "FAIL  $1"
    fails=$((fails + 1))
  fi
}
# has RULE FROM: true when RULE reports a violation from module FROM
has() { echo "any(.summary.violations[]; .rule.name == \"$1\" and .from == \"$2\")"; }
hasnt() { echo "($(has "$1" "$2")) | not"; }

check "cycle:         a.ts <-> b.ts runtime cycle is an error" "$(has no-circular src/cycle/a.ts)"
check "type cycle:    import type cycle is allowed" "($(hasnt no-circular src/lib/type-x.ts)) and ($(hasnt no-circular src/lib/type-y.ts))"
check "self export:   export * as Self from \"./self\" is allowed" "$(hasnt no-circular src/lib/self-namespace.ts)"
check "alias:         @/ tsconfig alias resolves" "$(hasnt not-to-unresolvable src/lib/alias.ts)"
check "unresolvable:  import of a missing file is an error" "$(has not-to-unresolvable src/lib/unresolvable.ts)"
check "ghost dep:     package not in package.json is an error" "$(has not-to-unresolvable src/lib/ghost-dep.ts)"
check "test import:   production code importing a .test.ts is an error" "$(has not-to-test src/lib/imports-test.ts)"
check "ai-xam:        domain importing components is an error" "$(has ai-xam-domain-is-pure src/pages/ai-xam/domain/score.ts)"
check "ai-xam:        services importing components is an error" "$(has ai-xam-no-ui-below-components src/pages/ai-xam/services/ingest.ts)"
check "focus-session: controller importing components is an error" "$(has focus-session-controller-no-ui src/pages/home/focus-session/controller/timer.ts)"
check "learn-flow:    importing the session layer is an error" "$(has learn-flow-no-session src/command/learn-flow/extract.ts)"
check "orphan:        unused module is a warning, not an error" \
  'any(.summary.violations[]; .rule.name == "no-orphans" and .rule.severity == "warn" and .from == "src/lib/orphan.ts")'

echo
jq -r '.summary.violations[] | "\(.rule.severity)\t\(.rule.name)\t\(.from) -> \(.to)"' <<< "$out" | sort
echo

if [ "$fails" -gt 0 ]; then
  echo "$fails check(s) failed."
  exit 1
fi
echo "All 12 checks passed."

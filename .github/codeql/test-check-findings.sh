#!/usr/bin/env bash
# Tests check-findings.sh against small SARIF files cut from a real CodeQL run.
#
# testdata/new-findings.sarif: one finding that is in testdata/baseline.tsv, plus two new ones
#   (an unused variable and a useless assignment, added on purpose to ai-xam for the negative run).
# testdata/known-only.sarif: only the baselined finding.
# testdata/baseline.tsv: that finding, plus one entry whose code has since been fixed.
#
# Run from anywhere: bash .github/codeql/test-check-findings.sh
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
t="$dir/testdata"
fails=0
check() {
  if [ "$2" = "$3" ]; then
    echo "PASS  $1"
  else
    echo "FAIL  $1 (expected '$3', got '$2')"
    fails=$((fails + 1))
  fi
}
run() { set +e; out="$(bash "$dir/check-findings.sh" "$1" "$t/baseline.tsv" 2>&1)"; code=$?; set -e; }

run "$t/new-findings.sarif"
check "new findings:   exit code is 1" "$code" "1"
check "new findings:   both new findings are counted" "$(grep -o 'New (not in the baseline): \*\*[0-9]*' <<< "$out" | grep -o '[0-9]*$')" "2"
check "new findings:   unused variable gets a GitHub annotation" \
  "$(grep -c '^::error file=packages/app/src/pages/ai-xam/domain/tmp-quality-bugs.ts,line=3,title=js/unused-local-variable::' <<< "$out")" "1"
check "new findings:   useless assignment gets a GitHub annotation" \
  "$(grep -c '^::error .*title=js/useless-assignment-to-local::' <<< "$out")" "1"
check "new findings:   baselined finding is not annotated" "$(grep -c 'comparison-between-incompatible-types::' <<< "$out" || true)" "0"

run "$t/known-only.sarif"
check "known only:     exit code is 0" "$code" "0"
check "known only:     no new findings" "$(grep -o 'New (not in the baseline): \*\*[0-9]*' <<< "$out" | grep -o '[0-9]*$')" "0"
check "known only:     fixed baseline entry is reported" "$(grep -o 'no longer found: \*\*[0-9]*' <<< "$out" | grep -o '[0-9]*$')" "1"

if [ "$fails" -gt 0 ]; then
  echo "$fails check(s) failed."
  exit 1
fi
echo "All 8 checks passed."

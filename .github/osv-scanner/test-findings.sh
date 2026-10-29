#!/usr/bin/env bash
# Tests findings.jq against sample OSV-Scanner output (--format=json, v2.7.0 shape).
#
# testdata/sample-results.json uses two real osv.dev advisories (GHSA-jf85-cpcp-j695,
# GHSA-29mw-wpgm-hmr9) plus one synthetic advisory with no CVSS score.
# testdata/clean-results.json is a scan with no findings.
#
# Run from anywhere: bash .github/osv-scanner/test-findings.sh
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
out="$(jq -f "$dir/findings.jq" "$dir/testdata/sample-results.json")"
clean="$(jq -f "$dir/findings.jq" "$dir/testdata/clean-results.json")"

fails=0
check() {
  if jq -e "$2" <<< "$3" > /dev/null; then
    echo "PASS  $1"
  else
    echo "FAIL  $1"
    fails=$((fails + 1))
  fi
}

check "blocking:     CRITICAL 9.1 lodash@4.17.11 with fix 4.17.12 blocks" \
  'any(.[]; .package == "lodash" and .severity == "CRITICAL" and .fixed == ["4.17.12"] and .blocking)' "$out"
check "non-blocking: MEDIUM 5.3 lodash@4.17.11 is reported, not blocking" \
  'any(.[]; .package == "lodash" and .severity == "MEDIUM" and (.blocking | not))' "$out"
check "no-fix:       HIGH 7.5 lodash.trim@4.5.1 with no fixed version does not block" \
  'any(.[]; .package == "lodash.trim" and .severity == "HIGH" and .fixed == [] and (.blocking | not))' "$out"
check "no-CVSS:      empty max_severity falls back to HIGH label and blocks" \
  'any(.[]; .package == "no-cvss-pkg" and .score == null and .severity == "HIGH" and .blocking)' "$out"
check "clean:        no results gives an empty list" \
  '. == []' "$clean"
check "sorting:      blocking findings are listed first" \
  '[.[].blocking] == ([.[].blocking] | sort | reverse)' "$out"

echo
jq -r '.[] | "\(if .blocking then "BLOCK" else "  -  " end)  \(.severity)  \(.score // "n/a")  \(.package)@\(.version)  fixed=[\(.fixed | join(","))]  \(.source)"' <<< "$out"
echo

if [ "$fails" -gt 0 ]; then
  echo "$fails check(s) failed."
  exit 1
fi
echo "All 6 checks passed."

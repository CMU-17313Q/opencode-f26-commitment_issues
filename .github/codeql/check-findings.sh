#!/usr/bin/env bash
# Compares CodeQL SARIF results against the baseline in known-findings.tsv and fails on new findings.
#
#   bash .github/codeql/check-findings.sh <results.sarif> [baseline.tsv]   # check
#   BASELINE=write bash .github/codeql/check-findings.sh <results.sarif>    # rewrite the baseline
#
# A finding's key is rule|file|primaryLocationLineHash. CodeQL computes that hash from the flagged
# line's text, so the key survives code moving up or down the file but changes if the line itself changes.
# Writes a Markdown summary to $GITHUB_STEP_SUMMARY when set.
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
sarif="$1"
baseline="${2:-$dir/known-findings.tsv}"

# key <TAB> file:line <TAB> message, one per finding, sorted by key
findings="$(jq -r '.runs[].results[] | .locations[0].physicalLocation as $l
  | ["\(.ruleId)|\($l.artifactLocation.uri)|\(.partialFingerprints.primaryLocationLineHash)",
     "\($l.artifactLocation.uri):\($l.region.startLine)",
     (.message.text | gsub("[\t\n]"; " "))] | @tsv' "$sarif" | sort)"

if [ "${BASELINE:-}" = "write" ]; then
  {
    echo "# CodeQL code-quality findings that already existed when the check was added (upstream opencode code)."
    echo "# Only findings NOT listed here fail CI. Regenerate: BASELINE=write bash .github/codeql/check-findings.sh <sarif>"
    printf '%s\n' "$findings" | sed '/^$/d'
  } > "$baseline"
  echo "Wrote $(grep -vc '^#' "$baseline") known findings to $baseline"
  exit 0
fi

known="$(grep -v '^#' "$baseline" | cut -f1 | sort -u)"
new="$(printf '%s\n' "$findings" | sed '/^$/d' | awk -F'\t' 'NR==FNR { k[$1]; next } !($1 in k)' <(printf '%s\n' "$known") -)"
total="$(printf '%s\n' "$findings" | sed '/^$/d' | wc -l)"
count="$(printf '%s\n' "$new" | sed '/^$/d' | wc -l)"
fixed="$(comm -23 <(printf '%s\n' "$known" | sed '/^$/d') <(printf '%s\n' "$findings" | cut -f1 | sed '/^$/d' | sort -u) | wc -l)"

{
  echo "## CodeQL code quality"
  echo
  echo "Findings: **${total}**. New (not in the baseline): **${count}**. Baseline entries no longer found: **${fixed}**."
  if [ "$count" -gt 0 ]; then
    echo
    echo "| Rule | Location | Message |"
    echo "| --- | --- | --- |"
    printf '%s\n' "$new" | awk -F'\t' '{ split($1, k, "|"); printf "| %s | %s | %s |\n", k[1], $2, $3 }'
  fi
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"

if [ "$count" -gt 0 ]; then
  printf '%s\n' "$new" | awk -F'\t' '{ split($1, k, "|"); split($2, l, ":"); printf "::error file=%s,line=%s,title=%s::%s\n", l[1], l[2], k[1], $3 }'
  exit 1
fi

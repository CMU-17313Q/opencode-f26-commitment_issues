# Flattens OSV-Scanner JSON output (--format=json) into one row per finding:
# an alias group of advisories on one package version in one lockfile.
#
# score    groups[].max_severity (CVSS base score, computed by osv-scanner), or null
# severity from score; falls back to the advisory's database_specific.severity
# fixed    "fixed" events in the advisory's ranges for this package name
# blocking Critical with at least one fixed version
#
# Used by .github/workflows/osv-scanner.yml. Test locally with:
#   jq -f .github/osv-scanner/findings.jq osv-results.json

def level:
  if .score != null then
    if .score >= 9 then "CRITICAL"
    elif .score >= 7 then "HIGH"
    elif .score >= 4 then "MEDIUM"
    elif .score > 0 then "LOW"
    else "UNKNOWN"
    end
  else
    {"CRITICAL": "CRITICAL", "HIGH": "HIGH", "MODERATE": "MEDIUM", "MEDIUM": "MEDIUM", "LOW": "LOW"}[.label] // "UNKNOWN"
  end;

[
  .results[]? as $r
  | $r.packages[]? as $p
  | $p.groups[]? as $g
  | [$p.vulnerabilities[]? | select(.id | IN($g.ids[]))] as $vulns
  | {
      source: ($r.source.path | sub("^/github/workspace/"; "")),
      package: $p.package.name,
      version: $p.package.version,
      ids: $g.ids,
      score: ((($g.max_severity // "") | tonumber?) // null),
      label: ([$vulns[].database_specific.severity? // empty | ascii_upcase] | first // ""),
      fixed: ([$vulns[].affected[]? | select(.package.name == $p.package.name) | .ranges[]?.events[]? | .fixed // empty] | unique)
    }
  | .severity = level
  | .blocking = (.severity == "CRITICAL" and (.fixed | length > 0))
]
| sort_by((.blocking | not), -(.score // 0))

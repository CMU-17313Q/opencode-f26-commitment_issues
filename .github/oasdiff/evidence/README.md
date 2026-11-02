# oasdiff check: local run evidence

Output from running the oasdiff API contract check ([`oasdiff.yml`](../../workflows/oasdiff.yml)) locally with
oasdiff v1.35.0, the version the pinned `oasdiff-action@v0.1.21` uses. Every spec came from
[`script/openapi-snapshot.sh`](../../../script/openapi-snapshot.sh), which serves the real `GET /doc`.

| File | What it shows |
| --- | --- |
| [`local-check-run.txt`](local-check-run.txt) | The check run end to end on this branch the way CI runs it: `origin/main` in a fresh worktree as the base, this branch as the head. It passes (exit 0) in about 17s of snapshot time. |
| [`baseline-merged-prs.txt`](baseline-merged-prs.txt) | The baseline from the design doc: the check replayed on PRs #29, #31 and #46, the most recent merged PRs that touched `packages/opencode/src`. No false positives: all three pass, and the specs parse as OpenAPI 3.1.0. |
| [`docker-parity.txt`](docker-parity.txt) | The design doc's original Docker approach (`docker compose up --build`, then `/doc`) against the Bun snapshot used by the workflow. The specs are byte-identical (same SHA-256), but Docker took about 8.5 minutes per snapshot versus about 5s with Bun. |
| [`negative-test.txt`](negative-test.txt) | The real `main` spec with simulated breaking changes: a renamed `Session` response field, a new required field on `POST /session/{sessionID}/command`, and a removed endpoint. The check fails with 15 ERR-level changes. An approved ignore-file entry removes exactly one of them, and a purely additive endpoint passes as INFO. |

## Known quirk: "No breaking changes to report, but the specs are different"

oasdiff prints this even for byte-identical specs. Our spec (inherited from upstream opencode) reuses three tag names
(`pty`, `projectCopy` and `opencode HttpApi`) with different descriptions, while OpenAPI requires unique tag names.
oasdiff then picks a description arbitrarily and reports a tag change. Only `oasdiff diff` shows this. `breaking` and
`changelog` don't check tag descriptions, so it never fails the check or adds changelog noise.

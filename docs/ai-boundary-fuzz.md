# AI Boundary Fuzzing: Project 3B

Owner: Ayan Fatima | Project 3B CI check (fast-check).

## Purpose

A dedicated property-based test suite exercises deterministic input and AI-output validation boundaries for AI-xam. This adds generated inputs and invariant checks beyond the existing example-based unit tests. No live model, API key, VPN, or CMU VM is required.

## Install (once)

From `packages/app` run:

```bash
bun add --dev fast-check
```

This must update and commit BOTH `packages/app/package.json` and the root `bun.lock` alongside the files in this contribution. Do not hand-edit the lockfile.

## Run locally

From the repository root:

```bash
cd packages/app
bun test --conditions=solid --preload ./happydom.ts ./src/pages/ai-xam/fuzz/ai-boundary.fuzz.test.ts
```

## Properties

- Supported positive-size documents are accepted; oversized or unsupported ones are rejected.
- Duplicate document names cannot bypass case-insensitive checks.
- Batch document uploads cannot exceed the per-category limit.
- AI-generated Exam DNA cannot cite an unauthorized source and rejects non-positive question count estimates.
- Mock-exam questions cannot share identifiers.
- AI-generated grades must be within the question's point range.
- Valid grades result in accurate totals and bounded percentages.
- Malformed AI JSON must be rejected.

Each test uses 200 generated examples, approximately 2,400 examples per suite. Randomness is controlled by fast-check; on a failure, its diagnostic includes the seed, path, and shrunk counterexample for replay. Make a separate regression test for a confirmed bug.

## CI integration

`.github/workflows/ai-boundary-fuzz.yml` runs on pull requests to `main`, pushes to `main`, and manual dispatch. It uses the repository's existing composite Bun setup action. `set -o pipefail` ensures an actual test failure fails the job even though output is piped through `tee`. The text log is always uploaded as a GitHub Actions artifact.

No production source code is modified by this check. Merge-blocking requires the team to configure this job as a required check, if branch rules permit.

## Design-document deviations

Scope is deliberately restricted to deterministic validator functions instead of calling a live LLM. This improves reproducibility, removes external costs and secrets, and makes the CI run suitable for a hosted GitHub runner. If the design doc expected live-model testing, note this change in your PR.

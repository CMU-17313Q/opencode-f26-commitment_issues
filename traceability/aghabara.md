# Traceability: Amen Ghabara (aghabara)

**Target feature:** `/learn-flow`, which draws an ASCII flowchart of a TypeScript/JavaScript function and explains it. Main files: `packages/opencode/src/command/learn-flow/extract.ts`, `graph.ts`, `render.ts`, `packages/opencode/src/tool/learn-flow.ts`, `packages/opencode/src/command/template/learn-flow.txt`

## Requirements

All tests are in `packages/opencode/test/flow/learn-flow.property.test.ts`.

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4B? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 | C-1, C-2: decisions and actions "look identical... a bit confusing" | Decision boxes look different from action boxes: every decision box starts with a `?` marker, and no other box does. | For any generated function, the number of boxes starting with `?` equals the number of decisions. For `grade`, the `score >= 90` and `score >= 80` boxes start with `?`, and the `return` boxes do not. | Yes | Only decision boxes are marked with `?` (invariant) | "R1: only decision boxes are marked with ?" |
| R2 | S-1: the "yes" part "did not make sense" | Each branch label says which decision it answers. | For `grade`, the branch lines read `score >= 90: yes` and `score >= 90: no`, not just `yes` and `no`. | No | Not tested in P4B | |
| R3 | S-3: "adding an arrow... would indicate the looping back more clearly" | A loop shows an arrow pointing back to its condition. | For `total`, the loop-back line contains an arrow character (`^`) and names `i < n`. | No | Not tested in P4B | |
| R4 | S-2: "`nums` is not clear... it is not obvious it is a user parameter" | The start box shows the function name and its parameters. | For `sumPositive`, the first box reads `start: sumPositive(nums)`. | No | Not tested in P4B | |
| R5 | O-1: "it should be an error" | If the function doesn't exist in the file, it shows an error naming the function and no chart. | For any generated file and any name that is not a function in it (including the file's own variable names), the result is the error `Function "<name>" not found.` and contains no box (`+---`). | Yes | A missing function always gives an error and no chart (invariant) | "R5: a missing function gives an error and no chart" |
| R6 | O-2: small differences are fine "but if you are nitpicky they can be an issue" | (a) Comments and blank lines don't change the chart at all. (b) Renaming a variable keeps the chart's shape; only box text changes. | (a) For any generated function, adding blank lines or comments before any statements gives exactly the same chart. (b) Renaming `total` to `sumup` gives the same box kinds and branches, and the chart equals the original with the name swapped. | Yes | (a) Comments and blank lines don't change the chart (metamorphic); (b) renaming keeps the shape (metamorphic) | "R6a: comments and blank lines don't change the chart"; "R6b: renaming a variable keeps the chart's shape" |
| R7 | C-3, C-4, O-3: it should say "the representation for this case is not accurate" | When part of a function can't be drawn, the chart still draws the rest, marks that part as `unsupported`, and shows a warning that the chart is incomplete, only when something unsupported is drawn. | For any generated function, the warning appears exactly when the chart has an `unsupported:` box. A reachable `try/catch` is always drawn as `unsupported: try/catch` with the warning, and the rest of the chart is still drawn. | Yes | Warning appears exactly when something is unsupported (invariant); a reachable try/catch is marked and warned about (invariant) | "R7: incomplete warning appears exactly when code is unsupported"; "R7: a reachable try/catch is marked unsupported and warned about" |

Properties written or suggested by opencode or another AI tool: R1, R5, R6a, R6b, R7 (both). Drafted with Claude; I reviewed each one against its requirement, ran them, and triaged the failures below.

## Requirement changes

| ID | Original requirement (P4A) | Revised requirement | Why it changed |
|---|---|---|---|
| R1 | Decision boxes look different from action boxes (checked only on `grade`). | Every decision box starts with a `?` marker, and no other box does, for every function. | Checkability: one example can't show the rule holds for every function. The user need (spotting where the path splits, C-1, C-2) is unchanged. |
| R5 | If the file or function doesn't exist, it shows an error message and no chart. | If the function doesn't exist in the file, it shows an error naming the function and no chart. The missing-file case stays covered by the existing tool tests. | Checkability: a missing file depends on the file system and permission prompts, which a property can't generate cleanly. The core need (O-1: "it should be an error", never a guessed chart) is kept. |
| R6 | Renaming variables or reformatting code does not change the chart's shape. Adding blank lines or comments gives exactly the same output. | (a) Comments and blank lines give exactly the same chart. (b) Renaming a variable keeps the same shape (box kinds and branches); box text may change. | Feasibility: renaming must change the box text (the chart shows the code), so "the same output" can't hold for renaming. The split keeps what O-2 cared about: no surprise changes. |
| R7 | When part of a function can't be drawn, the chart marks that part clearly and warns that the chart is incomplete. | Draw what can be drawn, mark the unsupported part, and add an "incomplete" warning only when something unsupported is drawn. The AI explanation covers the missing part in full. | Conflict: the classmate (C-3, C-4) wanted a chart with a warning, while the outside interviewee (O-3) wanted no chart and a fuller explanation. Keeping the chart, the warning and the full explanation meets both needs. |

R2, R3 and R4 are kept as written. They can all be built in `render.ts` with small text changes, and their acceptance criteria are already concrete. They are not tested in P4B.

## Triage log (Step 3)

| Property | Result | Outcome | What I did |
|---|---|---|---|
| R1, R7 (first run) | Test file failed to load: `renderFlowchart` had no options and `INCOMPLETE_NOTE` didn't exist. | Code bug (feature missing) | Added `markDecisions` and `warnIncomplete` options and `INCOMPLETE_NOTE` to `render.ts`, and turned both on in the `learn_flow` tool (`src/tool/learn-flow.ts`). They are options so the existing exact-output renderer tests keep passing. |
| R7, first version ("warning appears when the source contains `try`") | Failed. Shrunk counterexample: a `try { ... } catch` nested inside `if (a < 0) { ... }`. The chart correctly showed the unsupported box and warning, but my check only looked for lines starting with `try`, so it missed the indented one. | Wrong test | Rewrote the property to compare the warning against what the chart actually draws (any `unsupported:` box), and added a second R7 property with `try/catch` as the first statement so a drawn try/catch box is always checked. |
| R5, R6a, R6b | Passed on the first run. | None needed | |

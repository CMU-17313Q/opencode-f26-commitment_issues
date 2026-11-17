import { expect, test } from "bun:test"
import fc from "fast-check"
import { extractGraph } from "@/command/learn-flow/extract"
import type { Graph } from "@/command/learn-flow/graph"
import { INCOMPLETE_NOTE, renderFlowchart } from "@/command/learn-flow/render"

// Property-based tests for /learn-flow (P4B). Each property names the
// requirement it checks in traceability/aghabara.md.

// ---------------------------------------------------------------------------
// Generators
//
// Random strings would almost never parse as TypeScript, so instead we build
// random *functions* from a small grammar of the statements /learn-flow
// actually draws: assignments, returns, if/else, while and for loops, and
// (when allowed) try/catch, the construct it can't draw. Nesting goes two
// levels deep so we reach the cases interviewees cared about: branches inside
// loops (S-3), chains of decisions (C-1, C-2), early returns that make later
// code unreachable, and unsupported code in the middle of a function (C-3,
// O-3). Variable names come from a small fixed set so conditions and
// assignments refer to each other, like real code does.
// ---------------------------------------------------------------------------

const VARS = ["a", "b", "total"] as const
const variable = fc.constantFrom(...VARS)
const small = fc.integer({ min: 0, max: 9 })

const condition = fc
  .tuple(variable, fc.constantFrom("<", ">", "<=", ">=", "==="), small)
  .map(([v, op, n]) => `${v} ${op} ${n}`)
const assign = fc.tuple(variable, variable, small).map(([x, y, n]) => `${x} = ${y} + ${n}`)
const ret = variable.map((v) => `return ${v}`)

const indent = (lines: string[]) => lines.map((line) => `  ${line}`)

function statement(depth: number, allowTry: boolean): fc.Arbitrary<string[]> {
  const leaves = [assign.map((s) => [s]), ret.map((s) => [s])]
  if (depth === 0) return fc.oneof(...leaves)
  const inner = block(depth - 1, allowTry)
  const nested: fc.Arbitrary<string[]>[] = [
    fc
      .tuple(condition, inner, fc.option(inner, { nil: undefined }))
      .map(([c, yes, no]) => [
        `if (${c}) {`,
        ...indent(yes),
        ...(no ? ["} else {", ...indent(no)] : []),
        "}",
      ]),
    fc.tuple(condition, inner).map(([c, body]) => [`while (${c}) {`, ...indent(body), "}"]),
    fc.tuple(small, inner).map(([n, body]) => [`for (let i = 0; i < ${n}; i++) {`, ...indent(body), "}"]),
  ]
  if (allowTry) {
    nested.push(
      fc.tuple(inner, inner).map(([body, handler]) => ["try {", ...indent(body), "} catch (e) {", ...indent(handler), "}"]),
    )
  }
  return fc.oneof({ weight: 2, arbitrary: fc.oneof(...leaves) }, { weight: 3, arbitrary: fc.oneof(...nested) })
}

function block(depth: number, allowTry: boolean): fc.Arbitrary<string[]> {
  return fc.array(statement(depth, allowTry), { minLength: 1, maxLength: 3 }).map((parts) => parts.flat())
}

// A function body is a list of top-level statements, each one or more lines.
const body = (allowTry: boolean) => fc.array(statement(2, allowTry), { minLength: 1, maxLength: 4 })

function functionSource(statements: string[][], name = "f") {
  const lines = statements.flat()
  return [`function ${name}(v: number) {`, "  let a = v", "  let b = 0", "  let total = 0", ...indent(lines), "  return total", "}", ""].join(
    "\n",
  )
}

async function graphOf(source: string, name = "f"): Promise<Graph> {
  const result = await extractGraph(source, name)
  if (!result.ok) throw new Error(`${result.error}\n${source}`)
  return result.graph
}

// Box content lines, with the branch prefixes ("|   " / "    ") removed.
function boxLines(chart: string) {
  return chart
    .split("\n")
    .map((line) => line.replace(/^(?:\|   |    )*/, ""))
    .filter((line) => line.startsWith("| "))
}

const TIMEOUT = 30_000

// R1: Decision boxes look different from action boxes: every decision box
// starts with a "?" marker, and no step, return or start box does.
// Kind: invariant
test(
  "R1: only decision boxes are marked with ?",
  async () => {
    await fc.assert(
      fc.asyncProperty(body(true), async (statements) => {
        const graph = await graphOf(functionSource(statements))
        const decisions = graph.nodes.filter((node) => node.kind === "decision").length
        const marked = boxLines(renderFlowchart(graph, { markDecisions: true })).filter((line) =>
          line.startsWith("| ? "),
        ).length
        expect(marked).toBe(decisions)
      }),
    )
  },
  TIMEOUT,
)

// R5 (revised): If the function doesn't exist in the file, /learn-flow shows
// an error naming the function and no chart.
// Kind: invariant
// Generator: any generated file, and a name that is not a function in it.
// The names include the file's own variables (a, b, total), which exist in
// the file but are not functions, the closest a user can get to a "wrong"
// name that still looks right.
test(
  "R5: a missing function gives an error and no chart",
  async () => {
    const missingName = fc.oneof(
      fc.constantFrom(...VARS),
      fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,8}$/).filter((name) => name !== "f"),
    )
    await fc.assert(
      fc.asyncProperty(body(true), missingName, async (statements, name) => {
        const result = await extractGraph(functionSource(statements), name)
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.error).toBe(`Function "${name}" not found.`)
        expect(result.error).not.toContain("+---")
      }),
    )
  },
  TIMEOUT,
)

// R6a (revised): Comments and blank lines don't change the chart at all.
// Kind: metamorphic
// Generator: a random function, plus a random choice of what to insert
// before each top-level statement: nothing, a blank line, or a comment.
test(
  "R6a: comments and blank lines don't change the chart",
  async () => {
    const filler = fc.constantFrom("", "// a note for the reader", "/* explain this */")
    await fc.assert(
      fc.asyncProperty(
        body(true).chain((statements) =>
          fc.tuple(fc.constant(statements), fc.array(fc.option(filler, { nil: undefined }), {
            minLength: statements.length,
            maxLength: statements.length,
          })),
        ),
        async ([statements, fillers]) => {
          const padded = statements.map((lines, i) => (fillers[i] === undefined ? lines : [fillers[i]!, ...lines]))
          const original = renderFlowchart(await graphOf(functionSource(statements)))
          const reformatted = renderFlowchart(await graphOf(functionSource(padded)))
          expect(reformatted).toBe(original)
        },
      ),
    )
  },
  TIMEOUT,
)

// R6b (revised): Renaming a variable keeps the chart's shape: the same
// number and kinds of boxes and branches. Only the box text changes.
// Kind: metamorphic
// Generator: a random function in which the variable "total" is renamed to
// "sumup". Both names have 5 letters, so box widths and line wrapping can't
// change either, and the renamed chart must equal the original chart with
// the name swapped.
test(
  "R6b: renaming a variable keeps the chart's shape",
  async () => {
    await fc.assert(
      fc.asyncProperty(body(true), async (statements) => {
        const source = functionSource(statements)
        const renamed = source.replace(/\btotal\b/g, "sumup")
        const before = await graphOf(source)
        const after = await graphOf(renamed)

        expect(after.nodes.map((node) => node.kind)).toEqual(before.nodes.map((node) => node.kind))
        expect(after.edges).toEqual(before.edges)
        expect(renderFlowchart(after)).toBe(renderFlowchart(before).replace(/\btotal\b/g, "sumup"))
      }),
    )
  },
  TIMEOUT,
)

// R7 (revised): When part of a function can't be drawn, the chart still
// draws the rest, marks that part as "unsupported", and warns that the chart
// is incomplete, but only when something is unsupported.
// Kind: invariant
// Generator: random functions with and without try/catch. try/catch can land
// anywhere, including after an early return where it is unreachable and
// (correctly) not drawn, so the warning is tied to what is drawn, not to
// what the source text contains.
test(
  "R7: incomplete warning appears exactly when code is unsupported",
  async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean().chain(body), async (statements) => {
        const chart = renderFlowchart(await graphOf(functionSource(statements)), { warnIncomplete: true })
        const hasUnsupportedBox = boxLines(chart).some((line) => line.startsWith("| unsupported: "))
        expect(chart.includes(INCOMPLETE_NOTE)).toBe(hasUnsupportedBox)
      }),
    )
  },
  TIMEOUT,
)

// R7 (revised), second half: a try/catch that is reachable is always drawn
// as an "unsupported: try/catch" box, with the rest of the chart still drawn
// and the warning shown.
// Kind: invariant
// Generator: a try/catch as the first statement (so it is always reachable),
// followed by a random rest of the function.
test(
  "R7: a reachable try/catch is marked unsupported and warned about",
  async () => {
    const tryFirst = fc
      .tuple(block(1, false), block(1, false), body(true))
      .map(([tryBody, handler, rest]) => [["try {", ...indent(tryBody), "} catch (e) {", ...indent(handler), "}"], ...rest])
    await fc.assert(
      fc.asyncProperty(tryFirst, async (statements) => {
        const chart = renderFlowchart(await graphOf(functionSource(statements)), { warnIncomplete: true })
        const boxes = boxLines(chart)
        expect(boxes[0]).toStartWith("| start ")
        expect(boxes).toContainEqual(expect.stringMatching(/^\| unsupported: try\/catch +\|$/))
        expect(chart).toContain(INCOMPLETE_NOTE)
      }),
    )
  },
  TIMEOUT,
)

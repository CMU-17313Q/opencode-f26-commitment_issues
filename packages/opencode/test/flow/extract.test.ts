import { expect, test } from "bun:test"
import { buildGraph, findFunction, parseSource } from "@/command/learn-flow/extract"
import { renderFlowchart } from "@/command/learn-flow/render"

async function graphOf(source: string, name: string) {
  const found = findFunction(await parseSource(source), name)
  if (!found.ok) throw new Error(found.error)
  return buildGraph(found.node)
}

test("parses TypeScript source into a tree whose root node is a program", async () => {
  const tree = await parseSource("function f() { return 1 }")
  expect(tree.rootNode.type).toBe("program")
})

test("finds a function declaration by name", async () => {
  const tree = await parseSource("function discount(price: number) { return price }")
  const result = findFunction(tree, "discount")
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.node.type).toBe("function_declaration")
})

test("finds an arrow function assigned to a const", async () => {
  const tree = await parseSource("const double = (n: number) => n * 2")
  const result = findFunction(tree, "double")
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.node.type).toBe("arrow_function")
})

test("finds a class method by name", async () => {
  const tree = await parseSource("class Cart { total() { return 1 } }")
  const result = findFunction(tree, "total")
  expect(result.ok).toBe(true)
  if (result.ok) expect(result.node.type).toBe("method_definition")
})

test("returns an error result for an unknown function name", async () => {
  const tree = await parseSource("function f() { return 1 }")
  expect(findFunction(tree, "missing")).toEqual({ ok: false, error: 'Function "missing" not found.' })
})

test("returns an error result for source with syntax errors, instead of throwing", async () => {
  const tree = await parseSource("function f( { return 1")
  expect(() => findFunction(tree, "f")).not.toThrow()
  expect(findFunction(tree, "f")).toEqual({ ok: false, error: "Source has syntax errors; cannot find function." })
})

test("builds a start -> return graph for a single return", async () => {
  expect(await graphOf("function f() { return 1 }", "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "return", label: "return 1" },
    ],
    edges: [{ from: "n1", to: "n2" }],
  })
})

test("collapses consecutive plain statements into one step before the return", async () => {
  const source = "function f(a: number) { let x = a + 1; x = x * 2; return x }"
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let x = a + 1; x = x * 2" },
      { id: "n3", kind: "return", label: "return x" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
    ],
  })
})

test("builds only a start node for a function with an empty body", async () => {
  expect(await graphOf("function f() {}", "f")).toEqual({
    nodes: [{ id: "n1", kind: "start", label: "start" }],
    edges: [],
  })
})

test("a built graph renders through renderFlowchart with the labels in order", async () => {
  const graph = await graphOf("function f(a: number) { let x = a + 1; x = x * 2; return x }", "f")
  const output = renderFlowchart(graph)
  const positions = ["start", "let x = a + 1; x = x * 2", "return x"].map((text) => output.indexOf(text))
  expect(positions.every((position) => position >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((a, b) => a - b))
})

test("builds a decision with an early return and no else: the no edge goes to the next statement", async () => {
  const source = "function f(x: number) { if (x > 0) { return 1 } return 2 }"
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "decision", label: "x > 0" },
      { id: "n3", kind: "return", label: "return 1" },
      { id: "n4", kind: "return", label: "return 2" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3", label: "yes" },
      { from: "n2", to: "n4", label: "no" },
    ],
  })
})

test("builds an if/else where both branches return, dropping the unreachable code after it", async () => {
  const source = "function f(x: number) { if (x > 0) { return 1 } else { return 2 } return 3 }"
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "decision", label: "x > 0" },
      { id: "n3", kind: "return", label: "return 1" },
      { id: "n4", kind: "return", label: "return 2" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3", label: "yes" },
      { from: "n2", to: "n4", label: "no" },
    ],
  })
})

test("builds an if/else whose branches both rejoin at the next statement", async () => {
  const source = "function f(x: number) { let y = 0; if (x > 0) { y = 1 } else { y = 2 } return y }"
  const graph = await graphOf(source, "f")
  expect(graph).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let y = 0" },
      { id: "n3", kind: "decision", label: "x > 0" },
      { id: "n4", kind: "step", label: "y = 1" },
      { id: "n5", kind: "step", label: "y = 2" },
      { id: "n6", kind: "return", label: "return y" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4", label: "yes" },
      { from: "n3", to: "n5", label: "no" },
      { from: "n4", to: "n6" },
      { from: "n5", to: "n6" },
    ],
  })

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+-----------+",
      "| let y = 0 |",
      "+-----------+",
      "  |",
      "  v",
      "+-------+",
      "| x > 0 |",
      "+-------+",
      "+-- yes",
      "|   +-------+",
      "|   | y = 1 |",
      "|   +-------+",
      "|     |",
      "|     v",
      "|   +----------+",
      "|   | return y |",
      "|   +----------+",
      "+-- no",
      "    +-------+",
      "    | y = 2 |",
      "    +-------+",
      "      |",
      "      v",
      '    (continues at "return y" above)',
    ].join("\n"),
  )
})

test("builds a nested if recursively", async () => {
  const source = "function f(a: number, b: number) { if (a > 0) { if (b > 0) { return 1 } } return 2 }"
  const graph = await graphOf(source, "f")
  expect(graph).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "decision", label: "a > 0" },
      { id: "n3", kind: "decision", label: "b > 0" },
      { id: "n4", kind: "return", label: "return 1" },
      { id: "n5", kind: "return", label: "return 2" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3", label: "yes" },
      { from: "n3", to: "n4", label: "yes" },
      { from: "n3", to: "n5", label: "no" },
      { from: "n2", to: "n5", label: "no" },
    ],
  })

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+-------+",
      "| a > 0 |",
      "+-------+",
      "+-- yes",
      "|   +-------+",
      "|   | b > 0 |",
      "|   +-------+",
      "|   +-- yes",
      "|   |   +----------+",
      "|   |   | return 1 |",
      "|   |   +----------+",
      "|   +-- no",
      "|       +----------+",
      "|       | return 2 |",
      "|       +----------+",
      "+-- no",
      '    (continues at "return 2" above)',
    ].join("\n"),
  )
})

test("builds an else-if chain where every branch returns as nested decisions", async () => {
  const source =
    'function f(x: number) { if (x > 10) { return "big" } else if (x > 5) { return "medium" } else { return "small" } }'
  const graph = await graphOf(source, "f")
  expect(graph).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "decision", label: "x > 10" },
      { id: "n3", kind: "return", label: 'return "big"' },
      { id: "n4", kind: "decision", label: "x > 5" },
      { id: "n5", kind: "return", label: 'return "medium"' },
      { id: "n6", kind: "return", label: 'return "small"' },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3", label: "yes" },
      { from: "n2", to: "n4", label: "no" },
      { from: "n4", to: "n5", label: "yes" },
      { from: "n4", to: "n6", label: "no" },
    ],
  })

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+--------+",
      "| x > 10 |",
      "+--------+",
      "+-- yes",
      "|   +--------------+",
      '|   | return "big" |',
      "|   +--------------+",
      "+-- no",
      "    +-------+",
      "    | x > 5 |",
      "    +-------+",
      "    +-- yes",
      "    |   +-----------------+",
      '    |   | return "medium" |',
      "    |   +-----------------+",
      "    +-- no",
      "        +----------------+",
      '        | return "small" |',
      "        +----------------+",
    ].join("\n"),
  )
})

test("builds an else-if chain whose branches rejoin at the next statement", async () => {
  const source = "function f(x: number) { let y = 0; if (x > 10) { y = 2 } else if (x > 5) { y = 1 } return y }"
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let y = 0" },
      { id: "n3", kind: "decision", label: "x > 10" },
      { id: "n4", kind: "step", label: "y = 2" },
      { id: "n5", kind: "decision", label: "x > 5" },
      { id: "n6", kind: "step", label: "y = 1" },
      { id: "n7", kind: "return", label: "return y" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4", label: "yes" },
      { from: "n3", to: "n5", label: "no" },
      { from: "n5", to: "n6", label: "yes" },
      { from: "n4", to: "n7" },
      { from: "n6", to: "n7" },
      { from: "n5", to: "n7", label: "no" },
    ],
  })
})

test("builds a switch with a return in every case plus default", async () => {
  const source =
    'function f(day: number) { switch (day) { case 1: return "Mon"; case 2: return "Tue"; default: return "Other" } }'
  const graph = await graphOf(source, "f")
  expect(graph).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "decision", label: "day" },
      { id: "n3", kind: "return", label: 'return "Mon"' },
      { id: "n4", kind: "return", label: 'return "Tue"' },
      { id: "n5", kind: "return", label: 'return "Other"' },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3", label: "case 1" },
      { from: "n2", to: "n4", label: "case 2" },
      { from: "n2", to: "n5", label: "default" },
    ],
  })

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+-----+",
      "| day |",
      "+-----+",
      "+-- case 1",
      "|   +--------------+",
      '|   | return "Mon" |',
      "|   +--------------+",
      "+-- case 2",
      "|   +--------------+",
      '|   | return "Tue" |',
      "|   +--------------+",
      "+-- default",
      "    +----------------+",
      '    | return "Other" |',
      "    +----------------+",
    ].join("\n"),
  )
})

test("builds a switch whose cases break and rejoin at the next statement", async () => {
  const source =
    'function f(x: number) { let r = ""; switch (x) { case 1: r = "one"; break; case 2: r = "two"; break; default: r = "many" } return r }'
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: 'let r = ""' },
      { id: "n3", kind: "decision", label: "x" },
      { id: "n4", kind: "step", label: 'r = "one"' },
      { id: "n5", kind: "step", label: 'r = "two"' },
      { id: "n6", kind: "step", label: 'r = "many"' },
      { id: "n7", kind: "return", label: "return r" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4", label: "case 1" },
      { from: "n3", to: "n5", label: "case 2" },
      { from: "n3", to: "n6", label: "default" },
      { from: "n4", to: "n7" },
      { from: "n5", to: "n7" },
      { from: "n6", to: "n7" },
    ],
  })
})

test("adds a default edge to the next statement when a switch has no default", async () => {
  const source = 'function f(x: number) { switch (x) { case 1: return "one"; case 2: return "two" } return "other" }'
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "decision", label: "x" },
      { id: "n3", kind: "return", label: 'return "one"' },
      { id: "n4", kind: "return", label: 'return "two"' },
      { id: "n5", kind: "return", label: 'return "other"' },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3", label: "case 1" },
      { from: "n2", to: "n4", label: "case 2" },
      { from: "n2", to: "n5", label: "default" },
    ],
  })
})

test("continues a case that falls through into the next case's body", async () => {
  const source = "function f(x: number) { let y = 0; switch (x) { case 1: y += 1; case 2: y += 2; break } return y }"
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let y = 0" },
      { id: "n3", kind: "decision", label: "x" },
      { id: "n4", kind: "step", label: "y += 1" },
      { id: "n5", kind: "step", label: "y += 2" },
      { id: "n6", kind: "return", label: "return y" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4", label: "case 1" },
      { from: "n4", to: "n5" },
      { from: "n3", to: "n5", label: "case 2" },
      { from: "n5", to: "n6" },
      { from: "n3", to: "n6", label: "default" },
    ],
  })
})

test("builds a while loop with a back edge to the decision and a no edge to the next statement", async () => {
  const source = "function f(n: number) { let i = 0; let sum = 0; while (i < n) { sum += i; i++ } return sum }"
  const graph = await graphOf(source, "f")
  expect(graph).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let i = 0; let sum = 0" },
      { id: "n3", kind: "decision", label: "i < n" },
      { id: "n4", kind: "step", label: "sum += i; i++" },
      { id: "n5", kind: "return", label: "return sum" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4", label: "yes" },
      { from: "n4", to: "n3" },
      { from: "n3", to: "n5", label: "no" },
    ],
  })

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+------------------------+",
      "| let i = 0; let sum = 0 |",
      "+------------------------+",
      "  |",
      "  v",
      "+-------+",
      "| i < n |",
      "+-------+",
      "+-- yes",
      "|   +---------------+",
      "|   | sum += i; i++ |",
      "|   +---------------+",
      "|     |",
      "|     v",
      '|   (loops back to "i < n" above)',
      "+-- no",
      "    +------------+",
      "    | return sum |",
      "    +------------+",
    ].join("\n"),
  )
})

test("builds a for loop with the init before the decision and the update as the last body step", async () => {
  const source = "function f(n: number) { let sum = 0; for (let i = 0; i < n; i++) { sum += i } return sum }"
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let sum = 0" },
      { id: "n3", kind: "step", label: "let i = 0" },
      { id: "n4", kind: "decision", label: "i < n" },
      { id: "n5", kind: "step", label: "sum += i" },
      { id: "n6", kind: "step", label: "i++" },
      { id: "n7", kind: "return", label: "return sum" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5", label: "yes" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n4" },
      { from: "n4", to: "n7", label: "no" },
    ],
  })
})

test("builds a for...of loop as a decision labeled with the iteration", async () => {
  const source = "function f(items: number[]) { let sum = 0; for (const item of items) { sum += item } return sum }"
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let sum = 0" },
      { id: "n3", kind: "decision", label: "for item of items" },
      { id: "n4", kind: "step", label: "sum += item" },
      { id: "n5", kind: "return", label: "return sum" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4", label: "yes" },
      { from: "n4", to: "n3" },
      { from: "n3", to: "n5", label: "no" },
    ],
  })
})

test("builds a do...while loop whose yes edge goes back to the start of the body", async () => {
  const source = "function f(n: number) { let i = 0; let sum = 0; do { sum += i; i++ } while (i < n); return sum }"
  const graph = await graphOf(source, "f")
  expect(graph).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let i = 0; let sum = 0" },
      { id: "n3", kind: "step", label: "sum += i; i++" },
      { id: "n4", kind: "decision", label: "i < n" },
      { id: "n5", kind: "return", label: "return sum" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n3", label: "yes" },
      { from: "n4", to: "n5", label: "no" },
    ],
  })

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+------------------------+",
      "| let i = 0; let sum = 0 |",
      "+------------------------+",
      "  |",
      "  v",
      "+---------------+",
      "| sum += i; i++ |",
      "+---------------+",
      "  |",
      "  v",
      "+-------+",
      "| i < n |",
      "+-------+",
      "+-- yes",
      '|   (loops back to "sum += i; i++" above)',
      "+-- no",
      "    +------------+",
      "    | return sum |",
      "    +------------+",
    ].join("\n"),
  )
})

test("builds a loop with an early return inside the body", async () => {
  const source =
    "function f(arr: number[], x: number) { let i = 0; while (i < arr.length) { if (arr[i] === x) { return i } i++ } return -1 }"
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let i = 0" },
      { id: "n3", kind: "decision", label: "i < arr.length" },
      { id: "n4", kind: "decision", label: "arr[i] === x" },
      { id: "n5", kind: "return", label: "return i" },
      { id: "n6", kind: "step", label: "i++" },
      { id: "n7", kind: "return", label: "return -1" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4", label: "yes" },
      { from: "n4", to: "n5", label: "yes" },
      { from: "n4", to: "n6", label: "no" },
      { from: "n6", to: "n3" },
      { from: "n3", to: "n7", label: "no" },
    ],
  })
})

test("break leaves the loop and continue goes back to the loop", async () => {
  const source =
    "function f(arr: number[]) { let sum = 0; for (const v of arr) { if (v < 0) { continue } if (v > 100) { break } sum += v } return sum }"
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let sum = 0" },
      { id: "n3", kind: "decision", label: "for v of arr" },
      { id: "n4", kind: "decision", label: "v < 0" },
      { id: "n5", kind: "decision", label: "v > 100" },
      { id: "n6", kind: "step", label: "sum += v" },
      { id: "n7", kind: "return", label: "return sum" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4", label: "yes" },
      { from: "n4", to: "n5", label: "no" },
      { from: "n5", to: "n6", label: "no" },
      { from: "n6", to: "n3" },
      { from: "n4", to: "n3", label: "yes" },
      { from: "n5", to: "n7", label: "yes" },
      { from: "n3", to: "n7", label: "no" },
    ],
  })
})

test("a break inside a switch inside a loop targets the switch, not the loop", async () => {
  const source =
    "function f(arr: number[]) { let sum = 0; for (const v of arr) { switch (v) { case 1: sum += 1; break; default: sum += 2 } } return sum }"
  const graph = await graphOf(source, "f")
  // Both cases rejoin after the switch, then loop back to the for decision.
  expect(graph.edges).toContainEqual({ from: "n5", to: "n3" })
  expect(graph.edges).toContainEqual({ from: "n6", to: "n3" })
})

test("builds a nested loop with each loop looping back to its own decision", async () => {
  const source =
    "function f(n: number, m: number) { let sum = 0; let i = 0; while (i < n) { let j = 0; while (j < m) { sum += 1; j++ } i++ } return sum }"
  const graph = await graphOf(source, "f")
  expect(graph).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let sum = 0; let i = 0" },
      { id: "n3", kind: "decision", label: "i < n" },
      { id: "n4", kind: "step", label: "let j = 0" },
      { id: "n5", kind: "decision", label: "j < m" },
      { id: "n6", kind: "step", label: "sum += 1; j++" },
      { id: "n7", kind: "step", label: "i++" },
      { id: "n8", kind: "return", label: "return sum" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4", label: "yes" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6", label: "yes" },
      { from: "n6", to: "n5" },
      { from: "n5", to: "n7", label: "no" },
      { from: "n7", to: "n3" },
      { from: "n3", to: "n8", label: "no" },
    ],
  })

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+------------------------+",
      "| let sum = 0; let i = 0 |",
      "+------------------------+",
      "  |",
      "  v",
      "+-------+",
      "| i < n |",
      "+-------+",
      "+-- yes",
      "|   +-----------+",
      "|   | let j = 0 |",
      "|   +-----------+",
      "|     |",
      "|     v",
      "|   +-------+",
      "|   | j < m |",
      "|   +-------+",
      "|   +-- yes",
      "|   |   +---------------+",
      "|   |   | sum += 1; j++ |",
      "|   |   +---------------+",
      "|   |     |",
      "|   |     v",
      '|   |   (loops back to "j < m" above)',
      "|   +-- no",
      "|       +-----+",
      "|       | i++ |",
      "|       +-----+",
      "|         |",
      "|         v",
      '|       (loops back to "i < n" above)',
      "+-- no",
      "    +------------+",
      "    | return sum |",
      "    +------------+",
    ].join("\n"),
  )
})

test("makes a recursive call its own step node", async () => {
  const source = "function factorial(n: number): number { if (n <= 1) { return 1 } return n * factorial(n - 1) }"
  const graph = await graphOf(source, "factorial")
  expect(graph).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "decision", label: "n <= 1" },
      { id: "n3", kind: "return", label: "return 1" },
      { id: "n4", kind: "step", label: "recursive call: return n * factorial(n - 1)" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3", label: "yes" },
      { from: "n2", to: "n4", label: "no" },
    ],
  })

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+--------+",
      "| n <= 1 |",
      "+--------+",
      "+-- yes",
      "|   +----------+",
      "|   | return 1 |",
      "|   +----------+",
      "+-- no",
      "    +------------------------------------------+",
      "    | recursive call: return n * factorial(n - |",
      "    | 1)                                       |",
      "    +------------------------------------------+",
    ].join("\n"),
  )
})

test("does not merge a recursive call into the surrounding plain statements", async () => {
  const source = "function f(n: number) { let a = n; a = f(a - 1); let b = a; return b }"
  expect((await graphOf(source, "f")).nodes.map((node) => node.label)).toEqual([
    "start",
    "let a = n",
    "recursive call: a = f(a - 1)",
    "let b = a",
    "return b",
  ])
})

test("builds one unsupported node for try/catch and continues to the next statement", async () => {
  const source = "function f(x: number) { let a = x; try { a = risky(a) } catch (e) { a = 0 } return a }"
  const graph = await graphOf(source, "f")
  expect(graph).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let a = x" },
      { id: "n3", kind: "unsupported", label: "try/catch" },
      { id: "n4", kind: "return", label: "return a" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
    ],
  })

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+-----------+",
      "| let a = x |",
      "+-----------+",
      "  |",
      "  v",
      "+------------------------+",
      "| unsupported: try/catch |",
      "+------------------------+",
      "  |",
      "  v",
      "+----------+",
      "| return a |",
      "+----------+",
    ].join("\n"),
  )
})

test("draws an async function as a single unsupported node", async () => {
  const source = "async function load(id: number) { const r = await fetch(id); return r }"
  expect(await graphOf(source, "load")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "unsupported", label: "async function" },
    ],
    edges: [{ from: "n1", to: "n2" }],
  })
})

test("treats a statement with a callback as a plain step without entering the callback", async () => {
  const source = "function f(arr: number[]) { let total = 0; arr.forEach((x) => { if (x > 0) { total += x } }); return total }"
  expect(await graphOf(source, "f")).toEqual({
    nodes: [
      { id: "n1", kind: "start", label: "start" },
      { id: "n2", kind: "step", label: "let total = 0; arr.forEach((x) => { if (x > 0) { total += x } })" },
      { id: "n3", kind: "return", label: "return total" },
    ],
    edges: [
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
    ],
  })
})

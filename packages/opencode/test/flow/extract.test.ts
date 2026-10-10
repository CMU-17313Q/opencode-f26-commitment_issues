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

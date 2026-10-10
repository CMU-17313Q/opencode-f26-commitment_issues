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

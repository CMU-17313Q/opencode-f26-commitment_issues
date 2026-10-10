import { expect, test } from "bun:test"
import { findFunction, parseSource } from "@/command/learn-flow/extract"

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

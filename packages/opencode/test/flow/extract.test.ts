import { expect, test } from "bun:test"
import { parseSource } from "@/command/learn-flow/extract"

test("parses TypeScript source into a tree whose root node is a program", async () => {
  const tree = await parseSource("function f() { return 1 }")
  expect(tree.rootNode.type).toBe("program")
})

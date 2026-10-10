import { fileURLToPath } from "url"
import { Language, Parser, type Node, type Tree } from "web-tree-sitter"
import { lazy } from "@/util/lazy"
import type { Edge, Graph, Node as GraphNode } from "./graph"

// Same wasm resolution as src/tool/shell.ts.
const resolveWasm = (asset: string) => {
  if (asset.startsWith("file://")) return fileURLToPath(asset)
  if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
  const url = new URL(asset, import.meta.url)
  return fileURLToPath(url)
}

const parser = lazy(async () => {
  const { default: treeWasm } = await import("web-tree-sitter/tree-sitter.wasm" as string, {
    with: { type: "wasm" },
  })
  const treePath = resolveWasm(treeWasm)
  await Parser.init({
    locateFile() {
      return treePath
    },
  })
  const { default: tsWasm } = await import("tree-sitter-typescript/tree-sitter-typescript.wasm" as string, {
    with: { type: "wasm" },
  })
  const language = await Language.load(resolveWasm(tsWasm))
  const ts = new Parser()
  ts.setLanguage(language)
  return ts
})

export async function parseSource(source: string) {
  const tree = (await parser()).parse(source)
  if (!tree) throw new Error("Failed to parse TypeScript source")
  return tree
}

export type FindResult = { ok: true; node: Node } | { ok: false; error: string }

type Open = { from: string; label?: string }

// Returns the first function named `name`, in source order: a function
// declaration, an arrow function assigned to a variable, or a class method.
export function findFunction(tree: Tree, name: string): FindResult {
  if (tree.rootNode.hasError) return { ok: false, error: "Source has syntax errors; cannot find function." }

  const candidates = tree.rootNode.descendantsOfType(["function_declaration", "variable_declarator", "method_definition"])
  for (const candidate of candidates) {
    if (!candidate || candidate.childForFieldName("name")?.text !== name) continue
    if (candidate.type !== "variable_declarator") return { ok: true, node: candidate }
    const value = candidate.childForFieldName("value")
    if (value?.type === "arrow_function") return { ok: true, node: value }
  }
  return { ok: false, error: `Function "${name}" not found.` }
}

// Handles plain statements, returns, (nested) ifs including else-if chains,
// and switches. Loops/try are not handled yet and are treated as plain
// statements. Code after a point where every path has returned is
// unreachable and dropped.
//
// A branch that falls through rejoins at the next node created after the
// if/switch, which gives that node several incoming edges. renderFlowchart
// draws the first path in full and prints "(continues at ...)" for the others.
export function buildGraph(functionNode: Node): Graph {
  const nodes: GraphNode[] = []
  const edges: Edge[] = []
  // Open ends of the graph so far: the next node created gets an edge from each.
  let frontier: Open[] = []
  // One entry per enclosing switch: the open ends of its `break` statements.
  const breaks: Open[][] = []

  function add(kind: GraphNode["kind"], label: string) {
    const id = `n${nodes.length + 1}`
    nodes.push({ id, kind, label })
    for (const open of frontier) edges.push({ from: open.from, to: id, ...(open.label && { label: open.label }) })
    frontier = [{ from: id }]
    return id
  }

  function block(statements: Node[]) {
    let pending: string[] = []
    const flush = () => {
      if (pending.length > 0) add("step", pending.join("; "))
      pending = []
    }

    for (const statement of statements) {
      if (frontier.length === 0) return
      if (statement.type === "comment") continue
      if (statement.type === "return_statement") {
        flush()
        add("return", label(statement))
        frontier = []
        continue
      }
      if (statement.type === "break_statement" && breaks.length > 0) {
        flush()
        breaks[breaks.length - 1].push(...frontier)
        frontier = []
        continue
      }
      if (statement.type === "switch_statement") {
        flush()
        switchStatement(statement)
        continue
      }
      if (statement.type !== "if_statement") {
        pending.push(label(statement))
        continue
      }

      flush()
      const condition = label(statement.childForFieldName("condition") ?? statement).replace(/^\(|\)$/g, "")
      const decision = add("decision", condition)

      frontier = [{ from: decision, label: "yes" }]
      block(statementsOf(statement.childForFieldName("consequence")))
      const afterThen = frontier

      frontier = [{ from: decision, label: "no" }]
      block(statementsOf(statement.childForFieldName("alternative")))
      frontier = [...afterThen, ...frontier]
    }
    flush()
  }

  function switchStatement(statement: Node) {
    const discriminant = label(statement.childForFieldName("value") ?? statement).replace(/^\(|\)$/g, "")
    const decision = add("decision", discriminant)

    const exits: Open[] = []
    breaks.push(exits)
    const cases = (statement.childForFieldName("body")?.namedChildren ?? []).filter(
      (child) => child.type === "switch_case" || child.type === "switch_default",
    )
    let hasDefault = false
    // Open ends of the previous case when it doesn't break or return: they
    // continue into the next case's body.
    let fallthrough: Open[] = []
    for (const item of cases) {
      const isDefault = item.type === "switch_default"
      hasDefault ||= isDefault
      const edge = isDefault ? "default" : `case ${label(item.childForFieldName("value") ?? item)}`
      frontier = [...fallthrough, { from: decision, label: edge }]
      block(
        item
          .childrenForFieldName("body")
          .filter((child) => child !== null)
          .flatMap(statementsOf),
      )
      fallthrough = frontier
    }
    breaks.pop()

    frontier = [...exits, ...fallthrough, ...(hasDefault ? [] : [{ from: decision, label: "default" }])]
  }

  add("start", "start")

  const body = functionNode.childForFieldName("body")
  // Expression-bodied arrow function: `(n) => n * 2` returns its expression.
  if (body && body.type !== "statement_block") add("return", `return ${label(body)}`)
  else block(statementsOf(body))

  return { nodes, edges }
}

// A branch body is a `{ ... }` block, a lone statement, or an else clause
// wrapping either (so `else if` yields the nested if).
function statementsOf(node: Node | null): Node[] {
  if (!node) return []
  if (node.type === "statement_block" || node.type === "else_clause") return node.namedChildren.flatMap(statementsOf)
  return [node]
}

// One-line statement text without the trailing semicolon, so labels are stable
// regardless of source formatting.
function label(node: Node) {
  return node.text.replace(/\s+/g, " ").replace(/;$/, "").trim()
}

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

// Straight-line only: if/loops/switch/try are not handled yet and are treated
// as plain statements. Statements after a top-level return are unreachable
// and dropped.
export function buildGraph(functionNode: Node): Graph {
  const nodes: GraphNode[] = []
  const edges: Edge[] = []

  function add(kind: GraphNode["kind"], label: string) {
    const id = `n${nodes.length + 1}`
    const previous = nodes[nodes.length - 1]
    nodes.push({ id, kind, label })
    if (previous) edges.push({ from: previous.id, to: id })
  }

  add("start", "start")

  const body = functionNode.childForFieldName("body")
  // Expression-bodied arrow function: `(n) => n * 2` returns its expression.
  if (body && body.type !== "statement_block") add("return", `return ${label(body)}`)

  let pending: string[] = []
  const flush = () => {
    if (pending.length > 0) add("step", pending.join("; "))
    pending = []
  }

  for (const statement of body?.type === "statement_block" ? body.namedChildren : []) {
    if (statement.type === "comment") continue
    if (statement.type === "return_statement") {
      flush()
      add("return", label(statement))
      return { nodes, edges }
    }
    pending.push(label(statement))
  }
  flush()

  return { nodes, edges }
}

// One-line statement text without the trailing semicolon, so labels are stable
// regardless of source formatting.
function label(node: Node) {
  return node.text.replace(/\s+/g, " ").replace(/;$/, "").trim()
}

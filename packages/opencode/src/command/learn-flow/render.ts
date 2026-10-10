import type { Edge, Graph, Node } from "./graph"

const MAX_LABEL_LENGTH = 40

// Renders a graph as stacked boxes joined by arrows, top to bottom.
// Linear chains render as box -> box -> box. A "decision" node renders its
// branches stacked in full, one after another (never side by side). An edge
// to a node still on the current path (a loop back edge) prints a "loops
// back" line instead of recursing, so loops never render infinitely. An edge
// to a node already finished elsewhere (branches reconverging) prints a
// "continues" line instead of redrawing the box.
// Empty or invalid graphs never throw; they return a clear error string.
export function renderFlowchart(graph: Graph): string {
  const byID = new Map(graph.nodes.map((node) => [node.id, node]))

  const start = graph.nodes.find((node) => node.kind === "start")
  if (!start) return "(empty graph: no start node to render)"

  for (const edge of graph.edges) {
    const unknown = !byID.has(edge.from) ? edge.from : !byID.has(edge.to) ? edge.to : undefined
    if (unknown !== undefined) return `(invalid graph: edge references unknown node "${unknown}")`
  }

  const outgoing = new Map<string, Edge[]>()
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.from)
    if (list) list.push(edge)
    else outgoing.set(edge.from, [edge])
  }

  const drawn = new Set<string>()
  // Ancestors of the node currently being walked, in order. A back edge to
  // one of these is a loop; anything else already in `drawn` is a rejoin.
  const path: string[] = []
  const lines: string[] = []

  function branch(edge: Edge) {
    const next = byID.get(edge.to)
    if (!next) return
    lines.push(edge.label ? `  | ${edge.label}` : "  |", "  v")
    if (path.includes(next.id)) {
      lines.push(`(loops back to "${next.label}" above)`)
      return
    }
    if (drawn.has(next.id)) {
      lines.push(`(continues at "${next.label}" above)`)
      return
    }
    walk(next)
  }

  function walk(node: Node) {
    path.push(node.id)
    drawn.add(node.id)
    lines.push(renderBox(node))

    const edges = outgoing.get(node.id) ?? []
    // Decisions stack every labeled branch; other nodes have at most one edge.
    const branches = node.kind === "decision" ? edges : edges.slice(0, 1)
    branches.forEach((edge, i) => {
      if (i > 0) lines.push("")
      branch(edge)
    })

    path.pop()
  }

  walk(start)
  return lines.join("\n")
}

function renderBox(node: Node): string {
  // Flag unsupported constructs in the box itself, rather than trusting the
  // extractor's label text alone to make that clear.
  const text = node.kind === "unsupported" ? `unsupported: ${node.label}` : node.label
  const label = ` ${truncate(text)} `
  const border = "+" + "-".repeat(label.length) + "+"
  return [border, `|${label}|`, border].join("\n")
}

// Keeps every box at or below a fixed width so a long label can't misalign
// the arrows between boxes.
function truncate(text: string): string {
  if (text.length <= MAX_LABEL_LENGTH) return text
  return text.slice(0, MAX_LABEL_LENGTH - 1) + "…"
}


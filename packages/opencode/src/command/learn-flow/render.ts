import type { Edge, Graph, Node } from "./graph"

// Renders a graph as stacked boxes joined by arrows, top to bottom.
// Linear chains render as box -> box -> box. A "decision" node renders its
// "yes" branch in full, then its "no" branch in full underneath it (never
// side by side). A branch that rejoins a node already drawn points back to
// it instead of redrawing the box, so a shared node only appears once.
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
  const lines: string[] = []

  function branch(edge: Edge) {
    const next = byID.get(edge.to)
    if (!next) return
    lines.push(edge.label ? `  | ${edge.label}` : "  |", "  v")
    if (drawn.has(next.id)) {
      lines.push(`(continues at "${next.label}" above)`)
      return
    }
    walk(next)
  }

  function walk(node: Node) {
    drawn.add(node.id)
    lines.push(renderBox(node))

    const edges = outgoing.get(node.id) ?? []
    if (node.kind === "decision") {
      // Any number of labeled branches (yes/no for an if, or case labels for a
      // switch), each stacked in full before the next one starts.
      edges.forEach((edge, i) => {
        if (i > 0) lines.push("")
        branch(edge)
      })
      return
    }

    // Linear node: at most one outgoing edge.
    const [edge] = edges
    if (edge) branch(edge)
  }

  walk(start)
  return lines.join("\n")
}

function renderBox(node: Node): string {
  // Flag unsupported constructs in the box itself, rather than trusting the
  // extractor's label text alone to make that clear.
  const text = node.kind === "unsupported" ? `unsupported: ${node.label}` : node.label
  const label = ` ${text} `
  const border = "+" + "-".repeat(label.length) + "+"
  return [border, `|${label}|`, border].join("\n")
}


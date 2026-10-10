import type { Edge, Graph, Node } from "./graph"

// Renders a graph as stacked boxes joined by arrows, top to bottom.
// Linear chains render as box -> box -> box. A "decision" node renders its
// "yes" branch in full, then its "no" branch in full underneath it (never
// side by side). A branch that rejoins a node already drawn points back to
// it instead of redrawing the box, so a shared node only appears once.
export function renderFlowchart(graph: Graph): string {
  const byID = new Map(graph.nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, Edge[]>()
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.from)
    if (list) list.push(edge)
    else outgoing.set(edge.from, [edge])
  }

  const start = graph.nodes.find((node) => node.kind === "start")
  if (!start) return ""

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
      const yes = edges.find((edge) => edge.label === "yes")
      const no = edges.find((edge) => edge.label === "no")
      if (yes) branch(yes)
      if (no) {
        lines.push("")
        branch(no)
      }
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
  const label = ` ${node.label} `
  const border = "+" + "-".repeat(label.length) + "+"
  return [border, `|${label}|`, border].join("\n")
}


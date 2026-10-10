import type { Graph, Node } from "./graph"

// Renders a graph as stacked boxes joined by arrows, top to bottom.
// Only supports a single straight-line path (start -> steps -> return);
// decisions/branching are not handled yet (#37 follow-up).
export function renderFlowchart(graph: Graph): string {
  const path = linearPath(graph)
  return path.map(renderBox).join("\n  |\n  v\n")
}

// Walks from the "start" node by following each node's single outgoing edge.
// Driven by edges rather than node array order so the output doesn't depend
// on how the extractor happened to push nodes into the array.
function linearPath(graph: Graph): Node[] {
  const byID = new Map(graph.nodes.map((node) => [node.id, node]))
  const nextID = new Map(graph.edges.map((edge) => [edge.from, edge.to]))

  const start = graph.nodes.find((node) => node.kind === "start")
  if (!start) return []

  const path: Node[] = [start]
  let current = start
  while (true) {
    const id = nextID.get(current.id)
    const next = id ? byID.get(id) : undefined
    if (!next) break
    path.push(next)
    current = next
  }
  return path
}

function renderBox(node: Node): string {
  const label = ` ${node.label} `
  const border = "+" + "-".repeat(label.length) + "+"
  return [border, `|${label}|`, border].join("\n")
}

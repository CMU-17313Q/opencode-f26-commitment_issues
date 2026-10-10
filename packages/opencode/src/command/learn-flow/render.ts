import type { Edge, Graph, Node } from "./graph"

const MAX_LABEL_WIDTH = 40

// Renders a graph as boxes joined top to bottom. A linear chain renders as
// box -> box -> box, connected by a plain arrow. A "decision" node instead
// draws each outgoing branch under a "+-- <label>" marker, with that
// branch's whole subtree indented beneath it (a "|   " continuation prefix
// for branches with a following sibling, "    " for the last one) — so
// yes/no, multi-way, and loop-exit branches all visually belong to their
// decision. An edge to a node still on the current path (a loop back edge)
// prints a "loops back" line instead of recursing, so loops never render
// infinitely. An edge to a node already finished elsewhere (branches
// reconverging) prints a "continues" line instead of redrawing the box.
// Long labels wrap across multiple lines inside the box instead of losing
// text. Empty or invalid graphs never throw; they return a clear error string.
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

  // `withArrow` draws a plain "|"/"v" connector (linear chains); decision
  // branches pass false since their "+-- <label>" marker is the connector.
  function connect(edge: Edge, prefix: string, withArrow: boolean) {
    const next = byID.get(edge.to)
    if (!next) return
    if (withArrow) lines.push(`${prefix}  |`, `${prefix}  v`)
    if (path.includes(next.id)) {
      lines.push(`${prefix}(loops back to "${next.label}" above)`)
      return
    }
    if (drawn.has(next.id)) {
      lines.push(`${prefix}(continues at "${next.label}" above)`)
      return
    }
    walk(next, prefix)
  }

  function walk(node: Node, prefix: string) {
    path.push(node.id)
    drawn.add(node.id)
    for (const line of renderBox(node)) lines.push(prefix + line)

    const edges = outgoing.get(node.id) ?? []
    if (node.kind === "decision") {
      edges.forEach((edge, i) => {
        const isLast = i === edges.length - 1
        lines.push(prefix + (edge.label ? `+-- ${edge.label}` : "+--"))
        connect(edge, prefix + (isLast ? "    " : "|   "), false)
      })
    } else {
      // Linear node: at most one outgoing edge.
      const [edge] = edges
      if (edge) connect(edge, prefix, true)
    }

    path.pop()
  }

  walk(start, "")
  return lines.join("\n")
}

function renderBox(node: Node): string[] {
  // Flag unsupported constructs in the box itself, rather than trusting the
  // extractor's label text alone to make that clear.
  const text = node.kind === "unsupported" ? `unsupported: ${node.label}` : node.label
  const wrapped = wrap(text, MAX_LABEL_WIDTH)
  const width = Math.max(...wrapped.map((line) => line.length))
  const border = "+" + "-".repeat(width + 2) + "+"
  const content = wrapped.map((line) => `| ${line.padEnd(width)} |`)
  return [border, ...content, border]
}

// Greedy word wrap; hard-breaks a single word longer than `maxWidth` so the
// box width is always bounded even if the label has no spaces.
function wrap(text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ""
  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = word
    while (current.length > maxWidth) {
      lines.push(current.slice(0, maxWidth))
      current = current.slice(maxWidth)
    }
  }
  lines.push(current)
  return lines
}


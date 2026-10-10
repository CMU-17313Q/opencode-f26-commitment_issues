// Control-flow graph produced by the /learn-flow extractor (#36) and
// consumed by the ASCII flowchart renderer (#37+).

// "start"/"return" mark entry and exit points; "unsupported" covers constructs
// the extractor can't translate yet (loops, switch, try/catch, etc.).
export type NodeKind = "start" | "step" | "decision" | "return" | "unsupported"

export type NodeID = string

export type Node = {
  id: NodeID
  kind: NodeKind
  label: string
}

export type Edge = {
  from: NodeID
  to: NodeID
  // Only set on edges leaving a "decision" node, naming which branch they represent.
  label?: "yes" | "no"
}

export type Graph = {
  nodes: Node[]
  edges: Edge[]
}

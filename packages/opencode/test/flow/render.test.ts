import { expect, test } from "bun:test"
import type { Graph } from "@/command/learn-flow/graph"
import { renderFlowchart } from "@/command/learn-flow/render"

test("renders a linear start -> step -> return graph as boxes joined by arrows", () => {
  const graph: Graph = {
    nodes: [
      { id: "1", kind: "start", label: "start" },
      { id: "2", kind: "step", label: "price = price * 0.9" },
      { id: "3", kind: "return", label: "return price" },
    ],
    edges: [
      { from: "1", to: "2" },
      { from: "2", to: "3" },
    ],
  }

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+---------------------+",
      "| price = price * 0.9 |",
      "+---------------------+",
      "  |",
      "  v",
      "+--------------+",
      "| return price |",
      "+--------------+",
    ].join("\n"),
  )
})

test("renders a decision node's yes/no branches stacked top to bottom, not side by side", () => {
  // function discount(price) { if (price > 100) { return price * 0.9 } return price }
  const graph: Graph = {
    nodes: [
      { id: "1", kind: "start", label: "start" },
      { id: "2", kind: "decision", label: "price > 100" },
      { id: "3", kind: "return", label: "return price * 0.9" },
      { id: "4", kind: "return", label: "return price" },
    ],
    edges: [
      { from: "1", to: "2" },
      { from: "2", to: "3", label: "yes" },
      { from: "2", to: "4", label: "no" },
    ],
  }

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+-------------+",
      "| price > 100 |",
      "+-------------+",
      "  | yes",
      "  v",
      "+--------------------+",
      "| return price * 0.9 |",
      "+--------------------+",
      "",
      "  | no",
      "  v",
      "+--------------+",
      "| return price |",
      "+--------------+",
    ].join("\n"),
  )
})

test("renders an unsupported node as a clearly labeled box", () => {
  const graph: Graph = {
    nodes: [
      { id: "1", kind: "start", label: "start" },
      { id: "2", kind: "unsupported", label: "for loop" },
    ],
    edges: [{ from: "1", to: "2" }],
  }

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+-----------------------+",
      "| unsupported: for loop |",
      "+-----------------------+",
    ].join("\n"),
  )
})

test("renders a nested if, with the inner decision drawn inside the outer branch", () => {
  // function f(a, b) {
  //   if (a > 0) {
  //     if (b > 0) { return 1 }
  //     return 2
  //   }
  //   return 3
  // }
  const graph: Graph = {
    nodes: [
      { id: "1", kind: "start", label: "start" },
      { id: "2", kind: "decision", label: "a > 0" },
      { id: "3", kind: "decision", label: "b > 0" },
      { id: "4", kind: "return", label: "return 1" },
      { id: "5", kind: "return", label: "return 2" },
      { id: "6", kind: "return", label: "return 3" },
    ],
    edges: [
      { from: "1", to: "2" },
      { from: "2", to: "3", label: "yes" },
      { from: "3", to: "4", label: "yes" },
      { from: "3", to: "5", label: "no" },
      { from: "2", to: "6", label: "no" },
    ],
  }

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+-------+",
      "| a > 0 |",
      "+-------+",
      "  | yes",
      "  v",
      "+-------+",
      "| b > 0 |",
      "+-------+",
      "  | yes",
      "  v",
      "+----------+",
      "| return 1 |",
      "+----------+",
      "",
      "  | no",
      "  v",
      "+----------+",
      "| return 2 |",
      "+----------+",
      "",
      "  | no",
      "  v",
      "+----------+",
      "| return 3 |",
      "+----------+",
    ].join("\n"),
  )
})

test("returns a clear error string for an empty graph, instead of throwing", () => {
  const graph: Graph = { nodes: [], edges: [] }
  expect(() => renderFlowchart(graph)).not.toThrow()
  expect(renderFlowchart(graph)).toBe("(empty graph: no start node to render)")
})

test("returns a clear error string for an edge pointing at an unknown node, instead of throwing", () => {
  const graph: Graph = {
    nodes: [{ id: "1", kind: "start", label: "start" }],
    edges: [{ from: "1", to: "does-not-exist" }],
  }
  expect(() => renderFlowchart(graph)).not.toThrow()
  expect(renderFlowchart(graph)).toBe('(invalid graph: edge references unknown node "does-not-exist")')
})

test("rendering the same graph twice gives identical output", () => {
  const graph: Graph = {
    nodes: [
      { id: "1", kind: "start", label: "start" },
      { id: "2", kind: "decision", label: "price > 100" },
      { id: "3", kind: "return", label: "return price * 0.9" },
      { id: "4", kind: "return", label: "return price" },
    ],
    edges: [
      { from: "1", to: "2" },
      { from: "2", to: "3", label: "yes" },
      { from: "2", to: "4", label: "no" },
    ],
  }

  expect(renderFlowchart(graph)).toBe(renderFlowchart(graph))
})

test("renders a three-way switch-style decision, each branch stacked in full", () => {
  // function grade(score) {
  //   switch (true) {
  //     case score >= 90: return "A"
  //     case score >= 80: return "B"
  //     default: return "C"
  //   }
  // }
  const graph: Graph = {
    nodes: [
      { id: "1", kind: "start", label: "start" },
      { id: "2", kind: "decision", label: "score" },
      { id: "3", kind: "return", label: 'return "A"' },
      { id: "4", kind: "return", label: 'return "B"' },
      { id: "5", kind: "return", label: 'return "C"' },
    ],
    edges: [
      { from: "1", to: "2" },
      { from: "2", to: "3", label: "score >= 90" },
      { from: "2", to: "4", label: "score >= 80" },
      { from: "2", to: "5", label: "default" },
    ],
  }

  expect(renderFlowchart(graph)).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+-------+",
      "| score |",
      "+-------+",
      "  | score >= 90",
      "  v",
      '+------------+',
      '| return "A" |',
      '+------------+',
      "",
      "  | score >= 80",
      "  v",
      '+------------+',
      '| return "B" |',
      '+------------+',
      "",
      "  | default",
      "  v",
      '+------------+',
      '| return "C" |',
      '+------------+',
    ].join("\n"),
  )
})

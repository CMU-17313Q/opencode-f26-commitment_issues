import { expect, test } from "bun:test"
import type { Graph } from "@/command/learn-flow/graph"
import { renderFlowchart } from "@/command/learn-flow/render"

const LONG_CONDITION = "accountBalance - pendingWithdrawals > minimumRequiredBalanceThreshold"

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

test("renders a while loop: the body draws once, then loops back instead of recursing", () => {
  // while (i < n) { sum += i; i++ } return sum
  const graph: Graph = {
    nodes: [
      { id: "1", kind: "start", label: "start" },
      { id: "2", kind: "decision", label: "i < n" },
      { id: "3", kind: "step", label: "sum += i" },
      { id: "4", kind: "step", label: "i++" },
      { id: "5", kind: "return", label: "return sum" },
    ],
    edges: [
      { from: "1", to: "2" },
      { from: "2", to: "3", label: "yes" },
      { from: "3", to: "4" },
      { from: "4", to: "2" },
      { from: "2", to: "5", label: "no" },
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
      "| i < n |",
      "+-------+",
      "  | yes",
      "  v",
      "+----------+",
      "| sum += i |",
      "+----------+",
      "  |",
      "  v",
      "+-----+",
      "| i++ |",
      "+-----+",
      "  |",
      "  v",
      '(loops back to "i < n" above)',
      "",
      "  | no",
      "  v",
      "+------------+",
      "| return sum |",
      "+------------+",
    ].join("\n"),
  )
})

test("renders an early return inside a loop body, then the loop back edge for the rest of the body", () => {
  // while (i < n) { if (arr[i] == x) { return i } i++ } return -1
  const graph: Graph = {
    nodes: [
      { id: "1", kind: "start", label: "start" },
      { id: "2", kind: "decision", label: "i < n" },
      { id: "3", kind: "decision", label: "arr[i] == x" },
      { id: "4", kind: "return", label: "return i" },
      { id: "5", kind: "step", label: "i++" },
      { id: "6", kind: "return", label: "return -1" },
    ],
    edges: [
      { from: "1", to: "2" },
      { from: "2", to: "3", label: "yes" },
      { from: "3", to: "4", label: "yes" },
      { from: "3", to: "5", label: "no" },
      { from: "5", to: "2" },
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
      "| i < n |",
      "+-------+",
      "  | yes",
      "  v",
      "+-------------+",
      "| arr[i] == x |",
      "+-------------+",
      "  | yes",
      "  v",
      "+----------+",
      "| return i |",
      "+----------+",
      "",
      "  | no",
      "  v",
      "+-----+",
      "| i++ |",
      "+-----+",
      "  |",
      "  v",
      '(loops back to "i < n" above)',
      "",
      "  | no",
      "  v",
      "+-----------+",
      "| return -1 |",
      "+-----------+",
    ].join("\n"),
  )
})

test("renders a nested loop, each loop looping back to its own decision", () => {
  // while (i < n) { while (j < m) { sum += 1; j++ } i++ } return sum
  const graph: Graph = {
    nodes: [
      { id: "1", kind: "start", label: "start" },
      { id: "2", kind: "decision", label: "i < n" },
      { id: "3", kind: "decision", label: "j < m" },
      { id: "4", kind: "step", label: "sum += 1" },
      { id: "5", kind: "step", label: "j++" },
      { id: "6", kind: "step", label: "i++" },
      { id: "7", kind: "return", label: "return sum" },
    ],
    edges: [
      { from: "1", to: "2" },
      { from: "2", to: "3", label: "yes" },
      { from: "3", to: "4", label: "yes" },
      { from: "4", to: "5" },
      { from: "5", to: "3" },
      { from: "3", to: "6", label: "no" },
      { from: "6", to: "2" },
      { from: "2", to: "7", label: "no" },
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
      "| i < n |",
      "+-------+",
      "  | yes",
      "  v",
      "+-------+",
      "| j < m |",
      "+-------+",
      "  | yes",
      "  v",
      "+----------+",
      "| sum += 1 |",
      "+----------+",
      "  |",
      "  v",
      "+-----+",
      "| j++ |",
      "+-----+",
      "  |",
      "  v",
      '(loops back to "j < m" above)',
      "",
      "  | no",
      "  v",
      "+-----+",
      "| i++ |",
      "+-----+",
      "  |",
      "  v",
      '(loops back to "i < n" above)',
      "",
      "  | no",
      "  v",
      "+------------+",
      "| return sum |",
      "+------------+",
    ].join("\n"),
  )
})

const MAX_BOX_WIDTH = 44

test("truncates a box label longer than 40 characters so boxes stay aligned", () => {
  expect(LONG_CONDITION.length).toBeGreaterThan(40)

  const graph: Graph = {
    nodes: [
      { id: "1", kind: "start", label: "start" },
      { id: "2", kind: "decision", label: LONG_CONDITION },
      { id: "3", kind: "return", label: "return true" },
      { id: "4", kind: "return", label: "return false" },
    ],
    edges: [
      { from: "1", to: "2" },
      { from: "2", to: "3", label: "yes" },
      { from: "2", to: "4", label: "no" },
    ],
  }

  const output = renderFlowchart(graph)
  for (const line of output.split("\n")) expect(line.length).toBeLessThanOrEqual(MAX_BOX_WIDTH)

  expect(output).toBe(
    [
      "+-------+",
      "| start |",
      "+-------+",
      "  |",
      "  v",
      "+------------------------------------------+",
      "| accountBalance - pendingWithdrawals > m… |",
      "+------------------------------------------+",
      "  | yes",
      "  v",
      "+-------------+",
      "| return true |",
      "+-------------+",
      "",
      "  | no",
      "  v",
      "+--------------+",
      "| return false |",
      "+--------------+",
    ].join("\n"),
  )
})

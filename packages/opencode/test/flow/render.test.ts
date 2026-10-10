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

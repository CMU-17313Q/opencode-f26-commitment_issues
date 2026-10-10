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

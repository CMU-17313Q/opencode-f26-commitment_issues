import { PermissionV1 } from "@opencode-ai/core/v1/permission"
import { afterEach, describe, expect } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer } from "effect"
import path from "path"
import { Agent } from "../../src/agent/agent"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { SessionID, MessageID } from "../../src/session/schema"
import { LearnFlowTool } from "../../src/tool/learn-flow"
import { Truncate } from "@/tool/truncate"
import { Tool } from "@/tool/tool"
import { disposeAllInstances, provideInstance, testInstanceStoreLayer, tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

afterEach(async () => {
  await disposeAllInstances()
})

const ctx = {
  sessionID: SessionID.make("ses_test"),
  messageID: MessageID.make("msg_test"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

const it = testEffect(
  Layer.mergeAll(
    LayerNode.compile(LayerNode.group([Agent.node, FSUtil.node, CrossSpawnSpawner.node, Truncate.node])),
    testInstanceStoreLayer,
  ),
)

const run = Effect.fn("LearnFlowToolTest.run")(function* (
  args: Tool.InferParameters<typeof LearnFlowTool>,
  next: Tool.Context = ctx,
) {
  const info = yield* LearnFlowTool
  const tool = yield* info.init()
  return yield* tool.execute(args, next)
})

const exec = Effect.fn("LearnFlowToolTest.exec")(function* (
  dir: string,
  args: Tool.InferParameters<typeof LearnFlowTool>,
  next: Tool.Context = ctx,
) {
  return yield* provideInstance(dir)(run(args, next))
})

const put = Effect.fn("LearnFlowToolTest.put")(function* (p: string, content: string) {
  const fs = yield* FSUtil.Service
  yield* fs.writeWithDirs(p, content)
})

const load = Effect.fn("LearnFlowToolTest.load")(function* (p: string) {
  const fs = yield* FSUtil.Service
  return yield* fs.readFileString(p)
})

const list = Effect.fn("LearnFlowToolTest.list")(function* (p: string) {
  const fs = yield* FSUtil.Service
  return yield* fs.readDirectory(p)
})

const asks = () => {
  const items: Array<Omit<PermissionV1.Request, "id" | "sessionID" | "tool">> = []
  return {
    items,
    next: {
      ...ctx,
      ask: (req: Omit<PermissionV1.Request, "id" | "sessionID" | "tool">) =>
        Effect.sync(() => {
          items.push(req)
        }),
    },
  }
}

const glob = (p: string) =>
  process.platform === "win32" ? FSUtil.normalizePathPattern(p) : p.replaceAll("\\", "/")

const DISCOUNT = `function discount(price: number) {
  if (price > 100) {
    return price * 0.9
  }
  return price
}
`

// Each label must appear after the end of the previous one.
const expectInOrder = (output: string, labels: string[]) => {
  let from = 0
  for (const label of labels) {
    const index = output.indexOf(label, from)
    expect(index).toBeGreaterThanOrEqual(0)
    from = index + label.length
  }
}

describe("tool.learn_flow", () => {
  it.live("draws a flowchart of a function with the labels in order", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* put(path.join(dir, "discount.ts"), DISCOUNT)

      const result = yield* exec(dir, { filePath: path.join(dir, "discount.ts"), functionName: "discount" })
      expectInOrder(result.output, ["start", "price > 100", "yes", "return price * 0.9", "no", "return price"])
      expect(result.metadata.ok).toBe(true)
    }),
  )

  it.live("resolves a relative path against the project directory", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* put(path.join(dir, "src", "discount.ts"), DISCOUNT)

      const relative = yield* exec(dir, { filePath: path.join("src", "discount.ts"), functionName: "discount" })
      const absolute = yield* exec(dir, { filePath: path.join(dir, "src", "discount.ts"), functionName: "discount" })
      expect(relative.output).toContain("price > 100")
      expect(relative.output).toBe(absolute.output)
    }),
  )

  it.live("returns a readable error as output for an unknown function name", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* put(path.join(dir, "discount.ts"), DISCOUNT)

      const result = yield* exec(dir, { filePath: path.join(dir, "discount.ts"), functionName: "missing" })
      expect(result.output).toBe('Function "missing" not found.')
      expect(result.metadata.ok).toBe(false)
    }),
  )

  it.live("returns a readable message for a missing file", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()

      const result = yield* exec(dir, { filePath: path.join(dir, "nope.ts"), functionName: "discount" })
      expect(result.output).toContain("File not found or not readable")
      expect(result.metadata.ok).toBe(false)
    }),
  )

  it.live("returns a readable message when the path is a directory", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* put(path.join(dir, "src", "discount.ts"), DISCOUNT)

      const result = yield* exec(dir, { filePath: path.join(dir, "src"), functionName: "discount" })
      expect(result.output).toContain("File not found or not readable")
      expect(result.metadata.ok).toBe(false)
    }),
  )

  it.live("returns a readable error for a file with a syntax error", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* put(path.join(dir, "broken.ts"), "function discount( { return 1")

      const result = yield* exec(dir, { filePath: path.join(dir, "broken.ts"), functionName: "discount" })
      expect(result.output).toBe("Source has syntax errors; cannot find function.")
      expect(result.metadata.ok).toBe(false)
    }),
  )

  it.live("asks for read permission using the worktree-relative path", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped({ git: true })
      yield* put(path.join(dir, "src", "discount.ts"), DISCOUNT)

      const { items, next } = asks()
      yield* exec(dir, { filePath: path.join(dir, "src", "discount.ts"), functionName: "discount" }, next)
      const read = items.find((item) => item.permission === "read")
      expect(read).toBeDefined()
      expect(read!.patterns).toEqual([path.join("src", "discount.ts")])
      expect(items.some((item) => item.permission === "external_directory")).toBe(false)
    }),
  )

  it.live("asks for external_directory permission for a path outside the project", () =>
    Effect.gen(function* () {
      const outer = yield* tmpdirScoped()
      const dir = yield* tmpdirScoped({ git: true })
      yield* put(path.join(outer, "discount.ts"), DISCOUNT)

      const { items, next } = asks()
      yield* exec(dir, { filePath: path.join(outer, "discount.ts"), functionName: "discount" }, next)
      const external = items.find((item) => item.permission === "external_directory")
      expect(external).toBeDefined()
      expect(external!.patterns).toContain(glob(path.join(outer, "*")))
    }),
  )

  it.live("does not modify the file or create any files", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      const file = path.join(dir, "discount.ts")
      yield* put(file, DISCOUNT)
      const before = { content: yield* load(file), entries: yield* list(dir) }

      yield* exec(dir, { filePath: file, functionName: "discount" })
      yield* exec(dir, { filePath: file, functionName: "missing" })

      expect(yield* load(file)).toBe(before.content)
      expect(yield* list(dir)).toEqual(before.entries)
    }),
  )

  it.live("renders an unsupported box for try/catch", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped()
      yield* put(
        path.join(dir, "safe.ts"),
        "function safe(x: number) { let a = x; try { a = risky(a) } catch (e) { a = 0 } return a }\n",
      )

      const result = yield* exec(dir, { filePath: path.join(dir, "safe.ts"), functionName: "safe" })
      expectInOrder(result.output, ["let a = x", "unsupported: try/catch", "return a"])
    }),
  )
})

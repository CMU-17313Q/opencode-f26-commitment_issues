import { describe, expect } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer } from "effect"
import { Command } from "../../src/command"
import { MCP } from "../../src/mcp"
import TEST_EXPLANATION from "../../src/command/template/test-explanation.txt"
import { testInstanceStoreLayer } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const mcp = Layer.mock(MCP.Service, { prompts: () => Effect.succeed({}) })

const it = testEffect(Layer.mergeAll(LayerNode.compile(Command.node, [[MCP.node, mcp]]), testInstanceStoreLayer))

describe("/learn-tests command", () => {
  it.instance("is recognized as a valid command", () =>
    Effect.gen(function* () {
      const commands = yield* Command.Service
      const command = yield* commands.get("learn-tests")

      expect(command?.name).toBe("learn-tests")
      expect(command?.source).toBe("command")
      expect(command?.description).toBeTruthy()
      expect((yield* commands.list()).map((item) => item.name)).toContain("learn-tests")
    }),
  )

  it.instance("uses the Test Explanation prompt template", () =>
    Effect.gen(function* () {
      const commands = yield* Command.Service
      const command = yield* commands.get("learn-tests")

      expect(command).toBeDefined()
      expect(yield* Effect.promise(async () => command?.template)).toContain(TEST_EXPLANATION)
    }),
  )

  it.instance("takes the selected tests as $ARGUMENTS", () =>
    Effect.gen(function* () {
      const commands = yield* Command.Service
      const command = yield* commands.get("learn-tests")

      expect(command).toBeDefined()
      expect(command?.hints).toContain("$ARGUMENTS")
    }),
  )

  it.instance("leaves the existing built-in commands unchanged", () =>
    Effect.gen(function* () {
      const commands = yield* Command.Service

      expect((yield* commands.get(Command.Default.INIT))?.description).toBe("guided AGENTS.md setup")
      expect((yield* commands.get(Command.Default.REVIEW))?.subtask).toBe(true)
    }),
  )
})

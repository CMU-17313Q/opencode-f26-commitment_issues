import { expect } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect } from "effect"
import { Command } from "@/command"
import { Config } from "@/config/config"
import { MCP } from "@/mcp"
import { Skill } from "@/skill"
import { testEffect } from "../lib/effect"

const it = testEffect(LayerNode.compile(LayerNode.group([Command.node, Config.node, MCP.node, Skill.node])))

it.instance("learn-recap appears in the command list", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    expect(list.some((c) => c.name === Command.Default.LEARN_RECAP)).toBe(true)
  }),
)

it.instance("learn-recap can be retrieved individually", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnRecap = yield* commands.get(Command.Default.LEARN_RECAP)
    expect(learnRecap).toBeDefined()
  }),
)

it.instance("learn-recap has the expected name, description, and source", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnRecap = yield* commands.get(Command.Default.LEARN_RECAP)
    expect(learnRecap?.name).toBe(Command.Default.LEARN_RECAP)
    expect(learnRecap?.description).toBe("recap what was learned")
    expect(learnRecap?.source).toBe("command")
  }),
)

it.instance("learn-recap template is non-empty", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnRecap = yield* commands.get(Command.Default.LEARN_RECAP)
    const template = yield* Effect.promise(() => Promise.resolve(learnRecap?.template))
    expect(typeof template).toBe("string")
    expect((template as string).length).toBeGreaterThan(0)
  }),
)

it.instance("learn-recap hints include $ARGUMENTS", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnRecap = yield* commands.get(Command.Default.LEARN_RECAP)
    expect(learnRecap?.hints).toContain("$ARGUMENTS")
  }),
)

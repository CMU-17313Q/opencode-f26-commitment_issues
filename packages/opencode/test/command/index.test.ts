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

it.instance("init and review are still retrievable after adding learn-recap", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const init = yield* commands.get(Command.Default.INIT)
    const review = yield* commands.get(Command.Default.REVIEW)
    expect(init?.name).toBe(Command.Default.INIT)
    expect(review?.name).toBe(Command.Default.REVIEW)
    expect(review?.subtask).toBe(true)
  }),
)

it.instance("command list contains init, review, and learn-recap", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    const names = list.map((c) => c.name)
    expect(names).toEqual(
      expect.arrayContaining([Command.Default.INIT, Command.Default.REVIEW, Command.Default.LEARN_RECAP]),
    )
  }),
)

it.instance("hints() does not throw on the learn-recap placeholder template", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnRecap = yield* commands.get(Command.Default.LEARN_RECAP)
    const template = yield* Effect.promise(() => Promise.resolve(learnRecap?.template))
    expect(() => Command.hints(template as string)).not.toThrow()
    expect(Command.hints(template as string)).toEqual(expect.any(Array))
  }),
)

it.instance("learn-recap template getter never throws and always returns a string", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnRecap = yield* commands.get(Command.Default.LEARN_RECAP)
    let template: unknown
    expect(() => {
      template = learnRecap?.template
    }).not.toThrow()
    const resolved = yield* Effect.promise(() => Promise.resolve(template))
    expect(typeof resolved).toBe("string")
  }),
)

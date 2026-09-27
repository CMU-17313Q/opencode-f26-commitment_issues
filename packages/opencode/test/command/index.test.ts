import { expect, test } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect } from "effect"
import { Command } from "@/command"
import { Config } from "@/config/config"
import { MCP } from "@/mcp"
import { Skill } from "@/skill"
import { testEffect } from "../lib/effect"

const it = testEffect(LayerNode.compile(LayerNode.group([Command.node, Config.node, MCP.node, Skill.node])))

it.instance("learn-tests appears in the command list", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    expect(list.some((c) => c.name === Command.Default.LEARN_TESTS)).toBe(true)
  }),
)

it.instance("learn-tests can be retrieved individually", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTests = yield* commands.get(Command.Default.LEARN_TESTS)
    expect(learnTests).toBeDefined()
  }),
)

it.instance("learn-tests default key is 'learn-tests'", () =>
  Effect.gen(function* () {
    expect(Command.Default.LEARN_TESTS).toBe("learn-tests")
  }),
)

it.instance("learn-tests has the expected name, description, and source", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTests = yield* commands.get(Command.Default.LEARN_TESTS)

    expect(learnTests?.name).toBe(Command.Default.LEARN_TESTS)
    expect(learnTests?.description).toBe("explain tests and why their assertions and setup matter")
    expect(learnTests?.source).toBe("command")
  }),
)

it.instance("learn-tests runs inline (not as a subtask) with no agent or model override", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTests = yield* commands.get(Command.Default.LEARN_TESTS)

    expect(learnTests?.subtask).toBeUndefined()
    expect(learnTests?.agent).toBeUndefined()
    expect(learnTests?.model).toBeUndefined()
  }),
)

it.instance("command list contains init, review, learn-quiz, and learn-tests", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    const names = list.map((c) => c.name)

    expect(names).toEqual(
      expect.arrayContaining([
        Command.Default.INIT,
        Command.Default.REVIEW,
        Command.Default.LEARN_QUIZ,
        Command.Default.LEARN_TESTS,
      ]),
    )
  }),
)

// ---------------------------------------------------------------------------
// hints() unit tests
// ---------------------------------------------------------------------------

test("hints() returns an empty array for an empty template", () => {
  expect(Command.hints("")).toEqual([])
})

test("hints() returns an empty array when there are no placeholders", () => {
  expect(Command.hints("Explain what this test verifies.")).toEqual([])
})

test("hints() detects $ARGUMENTS", () => {
  expect(Command.hints("Explain these tests: $ARGUMENTS")).toEqual(["$ARGUMENTS"])
})

test("hints() dedupes and sorts numbered placeholders", () => {
  expect(Command.hints("$2 then $1 then $2 again")).toEqual(["$1", "$2"])
})

test("hints() lists numbered placeholders before $ARGUMENTS", () => {
  expect(Command.hints("$ARGUMENTS first, then $1")).toEqual(["$1", "$ARGUMENTS"])
})

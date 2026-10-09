import { describe, expect, test } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer } from "effect"
import { Command } from "../../src/command"
import { MCP } from "../../src/mcp"
import PROMPT_LEARN_RECAP from "../../src/command/template/learn-recap.txt"
import { testInstanceStoreLayer } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const mcp = Layer.mock(MCP.Service, { prompts: () => Effect.succeed({}) })

const it = testEffect(Layer.mergeAll(LayerNode.compile(Command.node, [[MCP.node, mcp]]), testInstanceStoreLayer))

// ---------------------------------------------------------------------------
// 0. Registration & retrieval (moved here from index.test.ts for consistency)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 1. Template content: what changed, why it works, relevant concepts
// ---------------------------------------------------------------------------

describe("learn-recap template content", () => {
  test("asks for what changed", () => {
    expect(PROMPT_LEARN_RECAP).toContain("**What changed**")
    expect(PROMPT_LEARN_RECAP).toContain("### What Changed")
  })

  test("asks for why the change works", () => {
    expect(PROMPT_LEARN_RECAP).toContain("**Why it works**")
    expect(PROMPT_LEARN_RECAP).toContain("### Why It Works")
  })

  test("asks for the relevant software engineering concepts", () => {
    expect(PROMPT_LEARN_RECAP).toContain("**Software engineering concepts**")
    expect(PROMPT_LEARN_RECAP).toContain("### Software Engineering Concepts")
  })
})

// ---------------------------------------------------------------------------
// 2. Template is the single source of truth
// ---------------------------------------------------------------------------

it.instance("learn-recap template is exactly the contents of learn-recap.txt", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnRecap = yield* commands.get(Command.Default.LEARN_RECAP)
    const template = yield* Effect.promise(() => Promise.resolve(learnRecap?.template))
    expect(template).toBe(PROMPT_LEARN_RECAP)
  }),
)

test("learn-recap template has no unreplaced ${path} placeholder", () => {
  // init/review substitute ${path} in index.ts; learn-recap does not, so its getter must not templatize the prompt
  expect(PROMPT_LEARN_RECAP).not.toContain("${path}")
})

// ---------------------------------------------------------------------------
// 3. Non-mutation
// ---------------------------------------------------------------------------

describe("learn-recap does not instruct file mutation", () => {
  test("explicitly tells the model not to modify the student's files", () => {
    expect(PROMPT_LEARN_RECAP).toContain(
      "Do not modify the student's files or generate additional implementation unless explicitly asked.",
    )
  })

  test("does not instruct the model to edit, write, delete, or remove files", () => {
    expect(PROMPT_LEARN_RECAP).not.toMatch(/\b(edit|write|delete|remove|overwrite)\b[^.\n]*\bfile/i)
  })

  it.instance("runs inline (not as a subtask) with no agent or model override", () =>
    Effect.gen(function* () {
      const commands = yield* Command.Service
      const learnRecap = yield* commands.get(Command.Default.LEARN_RECAP)
      expect(learnRecap?.subtask).toBeUndefined()
      expect(learnRecap?.agent).toBeUndefined()
      expect(learnRecap?.model).toBeUndefined()
    }),
  )
})

// ---------------------------------------------------------------------------
// 4. $ARGUMENTS substitution behavior
// ---------------------------------------------------------------------------

describe("learn-recap $ARGUMENTS substitution", () => {
  test("$ARGUMENTS is replaced with the given scope when invoked with arguments", () => {
    // Mirrors the plain $ARGUMENTS substitution SessionPrompt.command performs for commands without custom settings.
    const filled = PROMPT_LEARN_RECAP.replaceAll("$ARGUMENTS", "src/app.ts")
    expect(filled).toContain("Input: src/app.ts")
    expect(filled).not.toContain("$ARGUMENTS")
  })

  test("behaves sensibly with no arguments by falling back to uncommitted changes", () => {
    const filled = PROMPT_LEARN_RECAP.replaceAll("$ARGUMENTS", "")
    expect(filled).toContain("If no specific scope is provided, inspect the current uncommitted changes")
    expect(filled).toContain(
      "If there are no relevant code changes to explain, say so clearly instead of inventing a recap.",
    )
  })
})

// ---------------------------------------------------------------------------
// 5. Regression: teammates' commands remain registered alongside learn-recap
// ---------------------------------------------------------------------------

it.instance("init, review, learn-quiz, learn-test, and learn-recap are all registered with no duplicate names", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    const names = list.map((c) => c.name)

    expect(names).toEqual(
      expect.arrayContaining([
        Command.Default.INIT,
        Command.Default.REVIEW,
        Command.Default.LEARN_QUIZ,
        Command.Default.LEARN_TEST,
        Command.Default.LEARN_RECAP,
      ]),
    )
    expect(new Set(names).size).toBe(names.length)
  }),
)

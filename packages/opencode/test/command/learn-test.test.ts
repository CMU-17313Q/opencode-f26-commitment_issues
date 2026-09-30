import { expect, test } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect } from "effect"
import { Command } from "@/command"
import { Config } from "@/config/config"
import { MCP } from "@/mcp"
import { Skill } from "@/skill"
import { testEffect } from "../lib/effect"
import PROMPT_LEARN_TEST from "@/command/template/learn-test.txt"

const it = testEffect(LayerNode.compile(LayerNode.group([Command.node, Config.node, MCP.node, Skill.node])))

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

it.instance("learn-test appears in the command list", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    expect(list.some((c) => c.name === Command.Default.LEARN_TEST)).toBe(true)
  }),
)

it.instance("learn-test can be retrieved individually", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTest = yield* commands.get(Command.Default.LEARN_TEST)
    expect(learnTest).toBeDefined()
  }),
)

it.instance("learn-test default key is 'learn-test'", () =>
  Effect.gen(function* () {
    expect(Command.Default.LEARN_TEST).toBe("learn-test")
  }),
)

it.instance("learn-test has the expected name, description, and source", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTest = yield* commands.get(Command.Default.LEARN_TEST)

    expect(learnTest?.name).toBe(Command.Default.LEARN_TEST)
    expect(learnTest?.description).toBe("explains what the tests are doing and what behavior they verify")
    expect(learnTest?.source).toBe("command")
  }),
)

it.instance("learn-test runs inline with no subtask, agent, or model override", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTest = yield* commands.get(Command.Default.LEARN_TEST)

    expect(learnTest?.subtask).toBeUndefined()
    expect(learnTest?.agent).toBeUndefined()
    expect(learnTest?.model).toBeUndefined()
  }),
)

// ---------------------------------------------------------------------------
// Template wiring
// ---------------------------------------------------------------------------

it.instance("learn-test template is non-empty", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTest = yield* commands.get(Command.Default.LEARN_TEST)
    const template = yield* Effect.promise(() => Promise.resolve(learnTest?.template))

    expect(typeof template).toBe("string")
    expect((template as string).length).toBeGreaterThan(0)
  }),
)

it.instance("learn-test template is exactly the contents of learn-test.txt", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTest = yield* commands.get(Command.Default.LEARN_TEST)
    const template = yield* Effect.promise(() => Promise.resolve(learnTest?.template))

    expect(template).toBe(PROMPT_LEARN_TEST)
  }),
)

it.instance("learn-test template has no unresolved ${path} placeholder", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTest = yield* commands.get(Command.Default.LEARN_TEST)
    const template = yield* Effect.promise(() => Promise.resolve(learnTest?.template))

    expect(template as string).not.toContain("${path}")
  }),
)

it.instance("learn-test template is stable across repeated reads", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTest = yield* commands.get(Command.Default.LEARN_TEST)

    const first = yield* Effect.promise(() => Promise.resolve(learnTest?.template))
    const second = yield* Effect.promise(() => Promise.resolve(learnTest?.template))

    expect(first).toBe(second)
  }),
)

it.instance("learn-test hints match hints() computed from its template", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTest = yield* commands.get(Command.Default.LEARN_TEST)
    const template = yield* Effect.promise(() => Promise.resolve(learnTest?.template))

    expect(learnTest?.hints).toEqual(Command.hints(template as string))
  }),
)

it.instance("hints() does not throw on the learn-test placeholder template", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTest = yield* commands.get(Command.Default.LEARN_TEST)
    const template = yield* Effect.promise(() => Promise.resolve(learnTest?.template))

    expect(() => Command.hints(template as string)).not.toThrow()
    expect(Command.hints(template as string)).toEqual(expect.any(Array))
  }),
)

it.instance("learn-test template getter never throws and always returns a string", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnTest = yield* commands.get(Command.Default.LEARN_TEST)

    let template: unknown

    expect(() => {
      template = learnTest?.template
    }).not.toThrow()

    const resolved = yield* Effect.promise(() => Promise.resolve(template))
    expect(typeof resolved).toBe("string")
  }),
)

// ---------------------------------------------------------------------------
// Registry sanity / regressions
// ---------------------------------------------------------------------------

it.instance("init and review are still retrievable after adding learn-test", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service

    const init = yield* commands.get(Command.Default.INIT)
    const review = yield* commands.get(Command.Default.REVIEW)

    expect(init?.name).toBe(Command.Default.INIT)
    expect(review?.name).toBe(Command.Default.REVIEW)
    expect(review?.subtask).toBe(true)
  }),
)

it.instance("command list contains init, review, and learn-test", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    const names = list.map((c) => c.name)

    expect(names).toEqual(
      expect.arrayContaining([
        Command.Default.INIT,
        Command.Default.REVIEW,
        Command.Default.LEARN_TEST,
      ]),
    )
  }),
)

it.instance("command list has no duplicate learn-test entries", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()

    expect(list.filter((c) => c.name === Command.Default.LEARN_TEST)).toHaveLength(1)
  }),
)

it.instance("get() returns undefined for an unknown command", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const missing = yield* commands.get("learn-test-does-not-exist")

    expect(missing).toBeUndefined()
  }),
)

it.instance("every listed command has a name, a source, and a hints array", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()

    for (const c of list) {
      expect(typeof c.name).toBe("string")
      expect(c.name.length).toBeGreaterThan(0)
      expect(["command", "mcp", "skill"]).toContain(c.source ?? "")
      expect(Array.isArray(c.hints)).toBe(true)
    }
  }),
)

it.instance("every listed command is retrievable by name", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()

    for (const command of list) {
      const found = yield* commands.get(command.name)
      expect(found?.name).toBe(command.name)
    }
  }),
)

it.instance("command names in the list are unique", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    const names = list.map((c) => c.name)

    expect(new Set(names).size).toBe(names.length)
  }),
)

it.instance("init and review templates still resolve to non-empty strings", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service

    for (const name of [Command.Default.INIT, Command.Default.REVIEW]) {
      const cmd = yield* commands.get(name)
      const template = yield* Effect.promise(() => Promise.resolve(cmd?.template))

      expect(typeof template).toBe("string")
      expect((template as string).length).toBeGreaterThan(0)
    }
  }),
)

it.instance("init and review descriptions are unchanged", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service

    const init = yield* commands.get(Command.Default.INIT)
    const review = yield* commands.get(Command.Default.REVIEW)

    expect(init?.description).toBe("guided AGENTS.md setup")
    expect(review?.description).toBe("review changes [commit|branch|pr], defaults to uncommitted")
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

// ---------------------------------------------------------------------------
// Acceptance criteria for the real template.
// These remain todos while learn-test.txt is a placeholder.
// ---------------------------------------------------------------------------

test.todo("learn-test template accepts relevant test context via $ARGUMENTS", () => {
  expect(Command.hints(PROMPT_LEARN_TEST)).toContain("$ARGUMENTS")
})

test.todo("learn-test template identifies the purpose of the relevant tests", () => {
  expect(PROMPT_LEARN_TEST).toMatch(/\b(purpose|why.*test|what.*test.*verify)\b/i)
})

test.todo("learn-test template explains behavior rather than paraphrasing code line-by-line", () => {
  expect(PROMPT_LEARN_TEST).toMatch(/\b(behavior|verify|intent|purpose)\b/i)
})

test.todo("learn-test template explains why important assertions or setup steps matter", () => {
  expect(PROMPT_LEARN_TEST).toMatch(
    /\b(why|important|matter|assertion|setup|precondition|fixture)\b/i,
  )
})

test.todo("learn-test template does not reveal solutions or rewrite code", () => {
  expect(PROMPT_LEARN_TEST).toMatch(/(do not|don't|never|avoid)[^.]*(rewrite|solution|answer)/i)
})

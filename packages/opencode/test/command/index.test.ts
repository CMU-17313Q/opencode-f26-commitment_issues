import { expect, test } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect } from "effect"
import { Command } from "@/command"
import { Config } from "@/config/config"
import { MCP } from "@/mcp"
import { Skill } from "@/skill"
import { testEffect } from "../lib/effect"
import PROMPT_LEARN_QUIZ from "@/command/template/reflection-questions.txt"

const it = testEffect(LayerNode.compile(LayerNode.group([Command.node, Config.node, MCP.node, Skill.node])))

it.instance("learn-quiz appears in the command list", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    expect(list.some((c) => c.name === Command.Default.LEARN_QUIZ)).toBe(true)
  }),
)

it.instance("learn-quiz can be retrieved individually", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnQuiz = yield* commands.get(Command.Default.LEARN_QUIZ)
    expect(learnQuiz).toBeDefined()
  }),
)

it.instance("learn-quiz default key is 'learn-quiz'", () =>
  Effect.gen(function* () {
    expect(Command.Default.LEARN_QUIZ).toBe("learn-quiz")
  }),
)

it.instance("learn-quiz has the expected name, description, and source", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnQuiz = yield* commands.get(Command.Default.LEARN_QUIZ)
    expect(learnQuiz?.name).toBe(Command.Default.LEARN_QUIZ)
    expect(learnQuiz?.description).toBe("generate a quiz for decision justification comprehension")
    expect(learnQuiz?.source).toBe("command")
  }),
)

it.instance("learn-quiz runs inline (not as a subtask) with no agent or model override", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnQuiz = yield* commands.get(Command.Default.LEARN_QUIZ)
    expect(learnQuiz?.subtask).toBeUndefined()
    expect(learnQuiz?.agent).toBeUndefined()
    expect(learnQuiz?.model).toBeUndefined()
  }),
)

it.instance("learn-quiz template is non-empty", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnQuiz = yield* commands.get(Command.Default.LEARN_QUIZ)
    const template = yield* Effect.promise(() => Promise.resolve(learnQuiz?.template))
    expect(typeof template).toBe("string")
    expect((template as string).length).toBeGreaterThan(0)
  }),
)

it.instance("learn-quiz hints match hints() computed from its template", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnQuiz = yield* commands.get(Command.Default.LEARN_QUIZ)
    const template = yield* Effect.promise(() => Promise.resolve(learnQuiz?.template))
    expect(learnQuiz?.hints).toEqual(Command.hints(template as string))
  }),
)

it.instance("init and review are still retrievable after adding learn-quiz", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const init = yield* commands.get(Command.Default.INIT)
    const review = yield* commands.get(Command.Default.REVIEW)
    expect(init?.name).toBe(Command.Default.INIT)
    expect(review?.name).toBe(Command.Default.REVIEW)
    expect(review?.subtask).toBe(true)
  }),
)

it.instance("command list contains init, review, and learn-quiz", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    const names = list.map((c) => c.name)
    expect(names).toEqual(
      expect.arrayContaining([Command.Default.INIT, Command.Default.REVIEW, Command.Default.LEARN_QUIZ]),
    )
  }),
)

it.instance("command list has no duplicate learn-quiz entries", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    expect(list.filter((c) => c.name === Command.Default.LEARN_QUIZ)).toHaveLength(1)
  }),
)

it.instance("hints() does not throw on the learn-quiz placeholder template", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnQuiz = yield* commands.get(Command.Default.LEARN_QUIZ)
    const template = yield* Effect.promise(() => Promise.resolve(learnQuiz?.template))
    expect(() => Command.hints(template as string)).not.toThrow()
    expect(Command.hints(template as string)).toEqual(expect.any(Array))
  }),
)

it.instance("learn-quiz template getter never throws and always returns a string", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnQuiz = yield* commands.get(Command.Default.LEARN_QUIZ)
    let template: unknown
    expect(() => {
      template = learnQuiz?.template
    }).not.toThrow()
    const resolved = yield* Effect.promise(() => Promise.resolve(template))
    expect(typeof resolved).toBe("string")
  }),
)

// ---------------------------------------------------------------------------
// Template wiring
// ---------------------------------------------------------------------------

it.instance("learn-quiz template is exactly the contents of learn-quiz.txt", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnQuiz = yield* commands.get(Command.Default.LEARN_QUIZ)
    const template = yield* Effect.promise(() => Promise.resolve(learnQuiz?.template))
    expect(template).toBe(PROMPT_LEARN_QUIZ)
  }),
)

it.instance("learn-quiz template has no unreplaced ${path} placeholder", () =>
  Effect.gen(function* () {
    // init/review substitute ${path}; learn-quiz does not, so the template must not rely on it
    const commands = yield* Command.Service
    const learnQuiz = yield* commands.get(Command.Default.LEARN_QUIZ)
    const template = yield* Effect.promise(() => Promise.resolve(learnQuiz?.template))
    expect(template as string).not.toContain("${path}")
  }),
)

it.instance("learn-quiz template is stable across repeated reads", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnQuiz = yield* commands.get(Command.Default.LEARN_QUIZ)
    const first = yield* Effect.promise(() => Promise.resolve(learnQuiz?.template))
    const second = yield* Effect.promise(() => Promise.resolve(learnQuiz?.template))
    expect(first).toBe(second)
  }),
)

it.instance("repeated get() calls return the same learn-quiz definition", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const a = yield* commands.get(Command.Default.LEARN_QUIZ)
    const b = yield* commands.get(Command.Default.LEARN_QUIZ)
    expect(a?.name).toBe(b?.name)
    expect(a?.description).toBe(b?.description)
    expect(a?.hints).toEqual(b?.hints)
  }),
)

// ---------------------------------------------------------------------------
// Registry sanity / regressions
// ---------------------------------------------------------------------------

it.instance("get() returns undefined for an unknown command", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const missing = yield* commands.get("learn-quiz-does-not-exist")
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
      expect(["command", "mcp", "skill"]).toContain(c.source)
      expect(Array.isArray(c.hints)).toBe(true)
    }
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
// hints() unit tests (pure function, no layers needed)
// ---------------------------------------------------------------------------

test("hints() returns an empty array for an empty template", () => {
  expect(Command.hints("")).toEqual([])
})

test("hints() returns an empty array when there are no placeholders", () => {
  expect(Command.hints("Ask the student why they chose this design.")).toEqual([])
})

test("hints() detects $ARGUMENTS", () => {
  expect(Command.hints("Quiz me on $ARGUMENTS")).toEqual(["$ARGUMENTS"])
})

test("hints() dedupes and sorts numbered placeholders", () => {
  expect(Command.hints("$2 then $1 then $2 again")).toEqual(["$1", "$2"])
})

test("hints() lists numbered placeholders before $ARGUMENTS", () => {
  expect(Command.hints("$ARGUMENTS first, then $1")).toEqual(["$1", "$ARGUMENTS"])
})

// ---------------------------------------------------------------------------
// Acceptance criteria for the real template.
// These are todos while learn-quiz.txt is a placeholder; drop `.todo` once
// the real prompt lands.
// ---------------------------------------------------------------------------

test.todo("learn-quiz template accepts user context via $ARGUMENTS", () => {
  expect(Command.hints(PROMPT_LEARN_QUIZ)).toContain("$ARGUMENTS")
})

test.todo("learn-quiz template asks for design-decision justification ('why')", () => {
  expect(PROMPT_LEARN_QUIZ).toMatch(/\bwhy\b/i)
})

test.todo("learn-quiz template asks for at least one alternative-scenario question", () => {
  expect(PROMPT_LEARN_QUIZ).toMatch(/what would happen if|what if|alternative/i)
})

test.todo("learn-quiz template tells the model not to reveal solutions or rewrite code", () => {
  expect(PROMPT_LEARN_QUIZ).toMatch(/(do not|don't|never|avoid)[^.]*(solution|answer|rewrite)/i)
})

test.todo("learn-quiz template asks for a short set of questions", () => {
  expect(PROMPT_LEARN_QUIZ).toMatch(/\b([2-9]|few|short|brief)\b/i)
})

it.instance("hints() returns an empty array for a template with no placeholders", () =>
  Effect.gen(function* () {
    expect(Command.hints("")).toEqual([])
    expect(Command.hints("Ask the student about their code.")).toEqual([])
  }),
)

it.instance("hints() detects $ARGUMENTS", () =>
  Effect.gen(function* () {
    expect(Command.hints("Quiz me on $ARGUMENTS")).toEqual(["$ARGUMENTS"])
  }),
)

it.instance("hints() dedupes and sorts numbered placeholders", () =>
  Effect.gen(function* () {
    expect(Command.hints("$2 then $1 then $2 again")).toEqual(["$1", "$2"])
  }),
)

it.instance("hints() puts numbered placeholders before $ARGUMENTS", () =>
  Effect.gen(function* () {
    expect(Command.hints("$ARGUMENTS and $1")).toEqual(["$1", "$ARGUMENTS"])
  }),
)

import { describe, expect } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Fiber, Queue } from "effect"
import fc from "fast-check"
import { QuestionTool } from "../../src/tool/question"
import { Question } from "../../src/question"
import { SessionID, MessageID } from "../../src/session/schema"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "@/tool/truncate"
import { testEffect } from "../lib/effect"
import { EventV2Bridge } from "../../src/event-v2-bridge"

const ctx = {
  sessionID: SessionID.make("ses_property-session"),
  messageID: MessageID.make("msg_property-message"),
  callID: "property-call",
  agent: "test-agent",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

const it = testEffect(
  LayerNode.compile(LayerNode.group([Question.node, EventV2Bridge.node, Truncate.node, Agent.node])),
)

const pending = Effect.fn("QuestionPropertyTest.pending")(function* (question: Question.Interface) {
  const events = yield* EventV2Bridge.Service
  const asked = yield* Queue.unbounded<void>()
  const off = yield* events.listen((event) => {
    if (event.type === Question.Event.Asked.type) Queue.offerUnsafe(asked, undefined)
    return Effect.void
  })
  yield* Effect.addFinalizer(() => off)

  for (;;) {
    const item = (yield* question.list())[0]
    if (item) return item
    yield* Queue.take(asked).pipe(Effect.timeout("2 seconds"))
  }
})

// Generators
//
// A quiz is a list of open questions and multiple choice questions, as /learn-quiz asks for. Each multiple choice
// question records, as plain indexes, which option the stored key points at and which option the student picked.
// The oracle below works from those indexes, so it never re-implements the tool's string matching.
//
// - Labels are unique within a question but often differ only by case or a word, so a sloppy comparison would show.
// - The key is usually a valid label, sometimes padded with spaces (still valid), sometimes missing or not one of the
//   options (the model can get this wrong; the tool must not guess), mirroring what a real model might send.
// - The pick is an option, a skip, or a typed custom answer that matches no option.

const label = fc.stringMatching(/^[A-Za-z][A-Za-z ]{0,10}[A-Za-z]$/)

type Key = { kind: "valid"; index: number; padded: boolean } | { kind: "missing" } | { kind: "invalid"; text: string }
type Pick = { kind: "option"; index: number } | { kind: "skip" } | { kind: "custom"; text: string }

const choice = fc
  .uniqueArray(label, { minLength: 2, maxLength: 4, comparator: (a, b) => a.trim() === b.trim() })
  .chain((labels) =>
    fc.record({
      labels: fc.constant(labels),
      key: fc.oneof(
        {
          weight: 6,
          arbitrary: fc.record({
            kind: fc.constant("valid" as const),
            index: fc.nat(labels.length - 1),
            padded: fc.boolean(),
          }),
        },
        { weight: 1, arbitrary: fc.constant({ kind: "missing" as const }) },
        {
          weight: 1,
          arbitrary: label
            .filter((text) => !labels.some((item) => item.trim() === text.trim()))
            .map((text) => ({ kind: "invalid" as const, text })),
        },
      ) as fc.Arbitrary<Key>,
      pick: fc.oneof(
        { weight: 6, arbitrary: fc.record({ kind: fc.constant("option" as const), index: fc.nat(labels.length - 1) }) },
        { weight: 2, arbitrary: fc.constant({ kind: "skip" as const }) },
        {
          weight: 1,
          arbitrary: label.filter((text) => !labels.includes(text)).map((text) => ({ kind: "custom" as const, text })),
        },
      ) as fc.Arbitrary<Pick>,
    }),
  )

const open = fc.record({ text: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }) })

const quiz = fc.array(
  fc.oneof(
    choice.map((item) => ({ type: "mcq" as const, ...item })),
    open.map((item) => ({ type: "frq" as const, ...item })),
  ),
  {
    minLength: 1,
    maxLength: 6,
  },
)

type Quiz = typeof quiz extends fc.Arbitrary<infer T> ? T : never

function params(sample: Quiz) {
  return sample.map((item, i) => ({
    question: `Question text ${i + 1}?`,
    header: `Question ${i + 1}`,
    options: item.type === "mcq" ? item.labels.map((text) => ({ label: text, description: "" })) : [],
    ...(item.type === "mcq" && item.key.kind === "valid"
      ? { answer: item.key.padded ? ` ${item.labels[item.key.index]} ` : item.labels[item.key.index] }
      : {}),
    ...(item.type === "mcq" && item.key.kind === "invalid" ? { answer: item.key.text } : {}),
  }))
}

function replies(sample: Quiz) {
  return sample.map((item) => {
    if (item.type === "frq") return item.text === undefined ? [] : [item.text]
    if (item.pick.kind === "option") return [item.labels[item.pick.index]]
    if (item.pick.kind === "custom") return [item.pick.text]
    return []
  })
}

// The oracle: the verdict each question must get, from the generator's indexes alone.
function expected(sample: Quiz) {
  return sample.flatMap((item, i) => {
    if (item.type === "frq" || item.key.kind === "missing") return []
    if (item.key.kind === "invalid") return [`Question ${i + 1}: Ungraded. No valid answer key was stored.`]
    const key = item.labels[item.key.index]
    if (item.pick.kind === "skip") return [`Question ${i + 1}: Skipped. The answer is "${key}".`]
    if (item.pick.kind === "option" && item.pick.index === item.key.index) return [`Question ${i + 1}: Correct`]
    return [`Question ${i + 1}: Incorrect. The answer is "${key}".`]
  })
}

describe("tool.question grading properties", () => {
  // R5: Each multiple-choice question's correct option must be stored when the question is generated. Grading should
  // compare the student's pick to that stored option, rather than letting the model decide after seeing the pick.
  // Kind: model / oracle
  //
  // Runs the real question tool end to end: the model's tool call (with stored keys) goes in, the quiz view's reply
  // comes back, and the verdicts in the tool result are compared with the oracle. The same quiz and picks are then
  // run a second time, which must give the same verdicts, and the key must never be sent to the quiz view.
  it.instance(
    "R5: multiple choice picks are graded against the key stored with the question, the same way every time",
    () =>
      Effect.gen(function* () {
        const question = yield* Question.Service
        const toolInfo = yield* QuestionTool
        const tool = yield* toolInfo.init()
        const run = Effect.runPromiseWith(yield* Effect.context<EventV2Bridge.Service>())

        const grade = (sample: Quiz) =>
          run(
            Effect.gen(function* () {
              const fiber = yield* tool.execute({ questions: params(sample) }, ctx).pipe(Effect.forkScoped)
              const item = yield* pending(question)
              yield* question.reply({ requestID: item.id, answers: replies(sample) })
              const result = yield* Fiber.join(fiber)
              return { sent: item.questions, output: result.output }
            }).pipe(Effect.scoped),
          )

        yield* Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(quiz, async (sample) => {
              const first = await grade(sample)
              const second = await grade(sample)

              const verdicts = (output: string) => output.split("\n").filter((line) => line.startsWith("Question "))
              expect(verdicts(first.output)).toEqual(expected(sample))
              // Grading the same picks on the same questions twice gives the same verdicts.
              expect(verdicts(second.output)).toEqual(verdicts(first.output))
              // The stored key is never sent to the quiz view.
              for (const sent of first.sent) expect(sent).not.toHaveProperty("answer")
              expect(first.sent.map((item) => item.question)).toEqual(sample.map((_, i) => `Question text ${i + 1}?`))
            }),
            { numRuns: 60 },
          ),
        )
      }),
    60_000,
  )
})

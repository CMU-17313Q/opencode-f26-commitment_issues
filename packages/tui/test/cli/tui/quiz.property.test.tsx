/** @jsxImportSource @opentui/solid */
import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import type { QuestionRequest } from "@opencode-ai/sdk/v2"
import { tmpdir } from "../../fixture/fixture"
import { mountQuiz, wait } from "../../fixture/quiz"

// Generators
//
// A quiz is the mix /learn-quiz produces: open questions and multiple choice questions with 2 to 4 options, some
// with a hidden hint. Each question comes with what the student does on it: type an answer (or leave it blank) on an
// open question, pick an option (or pass it) on a multiple choice one. Generated quizzes are 2 to 5 questions long,
// so the first, middle, and last question boundaries all come up.
//
// The first question is always open. The quiz view focuses its answer box only on open questions, and the harness
// finds the box by waiting for that focus, which is the same layout the example tests in quiz.test.tsx use.

const answerText = fc.stringMatching(/^[a-z][a-z0-9 ,.']{0,15}$/)

const open = fc.record({
  kind: fc.constant("frq" as const),
  hint: fc.boolean(),
  answer: fc.option(answerText, { nil: undefined }),
})

const choice = fc.integer({ min: 2, max: 4 }).chain((size) =>
  fc.record({
    kind: fc.constant("mcq" as const),
    hint: fc.boolean(),
    size: fc.constant(size),
    answer: fc.option(fc.nat(size - 1), { nil: undefined }),
  }),
)

type Plan =
  | (typeof open extends fc.Arbitrary<infer T> ? T : never)
  | (typeof choice extends fc.Arbitrary<infer T> ? T : never)

const plans = fc
  .tuple(open, fc.array(fc.oneof(open, choice), { minLength: 1, maxLength: 4 }))
  .map(([first, rest]) => [first, ...rest])

const label = (question: number, option: number) => `Choice ${question + 1}-${option + 1}`

function request(plan: Plan[]): QuestionRequest {
  return {
    id: "que_property",
    sessionID: "ses_property",
    questions: plan.map((item, i) => ({
      header: `Question ${i + 1}`,
      question: `Why does step ${i + 1} work?${item.hint ? `\n\nHint: Look at step ${i + 1}.` : ""}`,
      options:
        item.kind === "mcq"
          ? Array.from({ length: item.size }, (_, option) => ({ label: label(i, option), description: "" }))
          : [],
    })),
  }
}

type Quiz = Awaited<ReturnType<typeof mountQuiz>>

// Gives question i the planned answer and moves to the next question. On the last question only an open answer is
// typed: picking an option there would submit the quiz.
async function fill(quiz: Quiz, plan: Plan[], i: number, toggleHint: boolean) {
  const item = plan[i]
  const last = i === plan.length - 1
  if (toggleHint) quiz.app.mockInput.pressKey("o", { ctrl: true })
  if (item.kind === "frq") {
    if (item.answer !== undefined) await quiz.answer(item.answer)
    if (!last) quiz.app.mockInput.pressTab()
    return
  }
  if (last) return
  if (item.answer === undefined) quiz.app.mockInput.pressTab()
  else quiz.app.mockInput.pressKey(String(item.answer + 1))
}

// What question i should show: its typed answer, or which option is marked.
async function expectKept(quiz: Quiz, plan: Plan[], i: number) {
  const item = plan[i]
  const frame = await quiz.frame()
  expect(frame).toContain(`Question ${i + 1} of ${plan.length}`)
  if (item.kind === "frq") {
    await wait(() => quiz.app.renderer.currentFocusedEditor === quiz.textarea)
    expect(quiz.textarea.plainText).toBe(item.answer ?? "")
    return
  }
  const kept = i === plan.length - 1 ? undefined : item.answer
  for (let option = 0; option < item.size; option++) {
    expect(frame).toContain(`${option === kept ? "■" : "□"} ${label(i, option)}`)
  }
}

describe("/learn-quiz view properties", () => {
  // R3: Moving between questions must keep each question's typed answer or multiple-choice pick exactly as the
  // student left it. Going back from the first question should do nothing.
  // Kind: round-trip
  //
  // Answer every question going forward (with hints toggled at random along the way), walk all the way back with
  // shift+tab, press shift+tab once more on Question 1, then walk forward again. Every question must show exactly
  // what was entered on the way out, both ways, and nothing is submitted or quit.
  test("R3: going back and forward again leaves every answer exactly as it was", async () => {
    await fc.assert(
      fc.asyncProperty(
        plans.chain((plan) =>
          fc.tuple(fc.constant(plan), fc.array(fc.boolean(), { minLength: plan.length, maxLength: plan.length })),
        ),
        async ([plan, hints]) => {
          await using tmp = await tmpdir()
          const quiz = await mountQuiz(tmp.path, request(plan))
          try {
            for (let i = 0; i < plan.length; i++) await fill(quiz, plan, i, hints[i])

            for (let i = plan.length - 1; i >= 0; i--) {
              await expectKept(quiz, plan, i)
              quiz.app.mockInput.pressTab({ shift: true })
            }
            // That last shift+tab was on Question 1, so the view must still be on Question 1, unchanged.
            await expectKept(quiz, plan, 0)

            for (let i = 0; i < plan.length; i++) {
              await expectKept(quiz, plan, i)
              if (i < plan.length - 1) quiz.app.mockInput.pressTab()
            }

            expect(quiz.submitted).toEqual([])
            expect(quiz.quits).toEqual([])
          } finally {
            quiz.app.renderer.destroy()
          }
        },
      ),
      { numRuns: 25 },
    )
  }, 120_000)

  // R4: If any question has been answered (a non-blank typed answer, including text still in the answer box, or a
  // picked option), esc must ask for confirmation before quitting. Cancelling keeps every answer; confirming quits
  // without sending anything to be graded; with nothing answered, esc quits straight away. A re-run starts fresh.
  // Kind: invariant
  //
  // Generator: a random quiz, how many questions to answer before pressing esc (0 up to all but the last, so the quiz
  // is never submitted by accident), and whether to leave a draft in the answer box. The 0-answers, draft-only, and
  // answered-on-a-multiple-choice-question cases all come up.
  test("R4: esc never throws answers away without asking, and quitting never submits", async () => {
    const scenario = plans.chain((plan) =>
      fc.record({
        plan: fc.constant(
          plan.map(
            (item, i): Plan =>
              item.kind === "frq"
                ? { ...item, answer: item.answer ?? `answer ${i + 1}` }
                : { ...item, answer: item.answer ?? 0 },
          ),
        ),
        answered: fc.nat(plan.length - 1),
        draft: fc.option(answerText, { nil: undefined }),
      }),
    )
    await fc.assert(
      fc.asyncProperty(scenario, async ({ plan, answered, draft }) => {
        await using tmp = await tmpdir()
        const quiz = await mountQuiz(tmp.path, request(plan))
        try {
          for (let i = 0; i < answered; i++) await fill(quiz, plan, i, false)
          const typed = plan[answered].kind === "frq" ? draft : undefined
          if (typed !== undefined) await quiz.answer(typed)

          quiz.app.mockInput.pressEscape()

          if (answered === 0 && typed === undefined) {
            await wait(() => quiz.quits.length > 0)
            expect(quiz.quits).toHaveLength(1)
            expect(quiz.submitted).toEqual([])
            return
          }

          await wait(() => quiz.app.captureCharFrame().includes("Your answers will be lost"))
          expect(quiz.quits).toEqual([])

          // Cancel: back on the same question with everything kept.
          quiz.app.mockInput.pressEscape()
          await wait(() => !quiz.app.captureCharFrame().includes("Your answers will be lost"))
          expect(await quiz.frame()).toContain(`Question ${answered + 1} of ${plan.length}`)
          if (typed !== undefined) {
            await wait(() => quiz.app.renderer.currentFocusedEditor === quiz.textarea)
            expect(quiz.textarea.plainText).toBe(typed)
          }
          for (let i = answered - 1; i >= 0; i--) {
            quiz.app.mockInput.pressTab({ shift: true })
            await expectKept(quiz, plan, i)
          }
          expect(quiz.quits).toEqual([])

          // Confirm: quits once and sends nothing.
          quiz.app.mockInput.pressEscape()
          await wait(() => quiz.app.captureCharFrame().includes("Your answers will be lost"))
          quiz.app.mockInput.pressEnter()
          await wait(() => quiz.quits.length > 0)
          expect(quiz.quits).toHaveLength(1)
          expect(quiz.submitted).toEqual([])
        } finally {
          quiz.app.renderer.destroy()
        }

        // Running /learn-quiz again opens a new quiz view, which starts on Question 1 with an empty answer.
        const again = await mountQuiz(tmp.path, request(plan))
        try {
          expect(await again.frame()).toContain(`Question 1 of ${plan.length}`)
          expect(again.textarea.plainText).toBe("")
        } finally {
          again.app.renderer.destroy()
        }
      }),
      { numRuns: 25 },
    )
  }, 120_000)

  // R2: The quiz view shows and submits exactly as many questions as it was given, with "Question i of N" progress.
  // Kind: invariant
  //
  // Generator: every count --count accepts (3 to 10), with a random mix of open and multiple choice questions.
  test("R2: the quiz view counts and returns exactly the questions it was given", async () => {
    const quizzes = fc
      .integer({ min: 3, max: 10 })
      .chain((count) =>
        fc.tuple(open, fc.array(fc.oneof(open, choice), { minLength: count - 1, maxLength: count - 1 })),
      )
      .map(([first, rest]) => [first, ...rest])
    await fc.assert(
      fc.asyncProperty(quizzes, async (plan) => {
        await using tmp = await tmpdir()
        const quiz = await mountQuiz(tmp.path, request(plan))
        try {
          for (let i = 0; i < plan.length; i++) {
            expect(await quiz.frame()).toContain(`Question ${i + 1} of ${plan.length}`)
            quiz.app.mockInput.pressKey("s", { ctrl: true })
          }
          await wait(() => quiz.submitted.length > 0)
          expect(quiz.submitted).toHaveLength(1)
          expect(quiz.submitted[0]).toHaveLength(plan.length)
        } finally {
          quiz.app.renderer.destroy()
        }
      }),
      { numRuns: 15 },
    )
  }, 120_000)
})

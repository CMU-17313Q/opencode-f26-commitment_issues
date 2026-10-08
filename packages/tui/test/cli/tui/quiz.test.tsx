/** @jsxImportSource @opentui/solid */
import { TextareaRenderable } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { onCleanup } from "solid-js"
import type { QuestionRequest } from "@opencode-ai/sdk/v2"
import { tmpdir } from "../../fixture/fixture"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"
import { TestTuiContexts } from "../../fixture/tui-environment"

const request: QuestionRequest = {
  id: "que_quiz",
  sessionID: "ses_quiz",
  questions: [1, 2, 3].map((n) => ({
    header: `Question ${n}`,
    question: `Why did you choose approach ${n}?`,
    options: [],
  })),
}

// Open, multiple choice, open: the mix /learn-quiz asks for.
const mixed: QuestionRequest = {
  id: "que_mixed",
  sessionID: "ses_quiz",
  questions: [
    { header: "Question 1", question: "Why did you cache the result?", options: [] },
    {
      header: "Question 2",
      question: "Why does `load` check the cache first?",
      options: ["Avoid a network call", "Sort the results", "Validate the input"].map((label) => ({
        label,
        description: "",
      })),
    },
    { header: "Question 3", question: "What would happen if the cache were empty?", options: [] },
  ],
}

// Questions end with a hidden hint, as /learn-quiz asks the model to write them. Question 3 has none.
const hinted: QuestionRequest = {
  id: "que_hinted",
  sessionID: "ses_quiz",
  questions: [
    {
      header: "Question 1",
      question: "Why do you store prices in cents?\n\nHint: Try adding 0.1 and 0.2 as dollars.",
      options: [],
    },
    {
      header: "Question 2",
      question: "Why does `removeItem` use `findIndex`?\n\nHint: Look at what `splice` needs.",
      options: ["To remove by position", "To sort the cart"].map((label) => ({ label, description: "" })),
    },
    { header: "Question 3", question: "What does `totalCents` return for an empty cart?", options: [] },
  ],
}

async function wait(fn: () => boolean, timeout = 2000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error("timed out waiting for condition")
    await Bun.sleep(10)
  }
}

async function mountQuiz(root: string, quiz = request) {
  const state = path.join(root, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")

  const [
    { QuizPrompt },
    { KVProvider },
    { ThemeProvider },
    { TuiConfigProvider },
    { OpencodeKeymapProvider, registerOpencodeKeymap },
  ] = await Promise.all([
    import("../../../src/routes/session/quiz"),
    import("../../../src/context/kv"),
    import("../../../src/context/theme"),
    import("../../../src/config"),
    import("../../../src/keymap"),
  ])

  const submitted: string[][][] = []
  const quits: number[] = []

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const resolvedConfig = createTuiResolvedConfig({ leader_timeout: 1000 })
    const off = registerOpencodeKeymap(keymap, renderer, resolvedConfig)
    onCleanup(off)

    return (
      <TestTuiContexts directory={root} paths={{ home: root, state, worktree: root }}>
        <OpencodeKeymapProvider keymap={keymap}>
          <TuiConfigProvider config={resolvedConfig}>
            <KVProvider>
              <ThemeProvider mode="dark">
                <QuizPrompt
                  request={quiz}
                  onSubmit={(answers) => submitted.push(answers)}
                  onQuit={() => quits.push(Date.now())}
                />
              </ThemeProvider>
            </KVProvider>
          </TuiConfigProvider>
        </OpencodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  const app = await testRender(() => <Harness />, { kittyKeyboard: true })
  await wait(() => app.renderer.currentFocusedEditor instanceof TextareaRenderable)
  const textarea = app.renderer.currentFocusedEditor
  if (!(textarea instanceof TextareaRenderable)) throw new Error("expected focused quiz textarea")

  return {
    app,
    textarea,
    submitted,
    quits,
    async frame() {
      await app.renderOnce()
      return app.captureCharFrame()
    },
    async answer(text: string) {
      await wait(() => app.renderer.currentFocusedEditor === textarea)
      await app.mockInput.typeText(text)
      await wait(() => textarea.plainText === text)
    },
  }
}

test("quiz shows one question at a time with progress", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path)

  try {
    const frame = await quiz.frame()
    expect(frame).toContain("Question 1 of 3")
    expect(frame).toContain("Why did you choose approach 1?")
    expect(frame).not.toContain("Why did you choose approach 2?")

    await quiz.answer("first")
    quiz.app.mockInput.pressEnter()

    const next = await quiz.frame()
    expect(next).toContain("Question 2 of 3")
    expect(next).toContain("Why did you choose approach 2?")
    expect(quiz.textarea.plainText).toBe("")
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("quiz submits every answer after the last question", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path)

  try {
    await quiz.answer("first")
    quiz.app.mockInput.pressEnter()
    await quiz.answer("second")
    quiz.app.mockInput.pressEnter()
    expect(await quiz.frame()).toContain("submit")
    await quiz.answer("third")
    quiz.app.mockInput.pressEnter()

    expect(quiz.submitted).toEqual([[["first"], ["second"], ["third"]]])
    expect(quiz.quits).toEqual([])
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("quiz keeps answers when going back and forth", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path)

  try {
    await quiz.answer("first")
    quiz.app.mockInput.pressEnter()
    await quiz.answer("second")

    quiz.app.mockInput.pressTab({ shift: true })
    expect(await quiz.frame()).toContain("Question 1 of 3")
    expect(quiz.textarea.plainText).toBe("first")

    quiz.app.mockInput.pressTab()
    expect(await quiz.frame()).toContain("Question 2 of 3")
    expect(quiz.textarea.plainText).toBe("second")
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("going back from the first question stays on it", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path)

  try {
    await quiz.answer("first")
    quiz.app.mockInput.pressTab({ shift: true })

    expect(await quiz.frame()).toContain("Question 1 of 3")
    expect(quiz.textarea.plainText).toBe("first")
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("skipping a question leaves it unanswered", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path)

  try {
    await quiz.answer("draft I want to drop")
    quiz.app.mockInput.pressKey("s", { ctrl: true })
    expect(await quiz.frame()).toContain("Question 2 of 3")

    quiz.app.mockInput.pressKey("s", { ctrl: true })
    await quiz.answer("third")
    quiz.app.mockInput.pressEnter()

    expect(quiz.submitted).toEqual([[[], [], ["third"]]])
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("quitting leaves the quiz without submitting", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path)

  try {
    await quiz.answer("first")
    quiz.app.mockInput.pressEnter()
    quiz.app.mockInput.pressEscape()
    await wait(() => quiz.quits.length > 0)

    expect(quiz.quits).toHaveLength(1)
    expect(quiz.submitted).toEqual([])
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("multiple choice questions show their options and take the highlighted one on enter", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path, mixed)

  try {
    await quiz.answer("to avoid repeat work")
    quiz.app.mockInput.pressEnter()

    const frame = await quiz.frame()
    expect(frame).toContain("Question 2 of 3")
    expect(frame).toContain("□ Avoid a network call")
    expect(frame).toContain("□ Validate the input")
    expect(frame).not.toMatch(/\d\. [□■]/)

    quiz.app.mockInput.pressArrow("down")
    quiz.app.mockInput.pressEnter()
    expect(await quiz.frame()).toContain("Question 3 of 3")

    await quiz.answer("it would load from the network")
    quiz.app.mockInput.pressEnter()

    expect(quiz.submitted).toEqual([
      [["to avoid repeat work"], ["Sort the results"], ["it would load from the network"]],
    ])
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("number keys choose a multiple choice option", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path, mixed)

  try {
    quiz.app.mockInput.pressKey("s", { ctrl: true })
    quiz.app.mockInput.pressKey("1")
    expect(await quiz.frame()).toContain("Question 3 of 3")
    quiz.app.mockInput.pressKey("s", { ctrl: true })

    expect(quiz.submitted).toEqual([[[], ["Avoid a network call"], []]])
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("multiple choice and typed answers are kept when going back", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path, mixed)

  try {
    await quiz.answer("first")
    quiz.app.mockInput.pressEnter()
    quiz.app.mockInput.pressKey("3")

    quiz.app.mockInput.pressTab({ shift: true })
    expect(await quiz.frame()).toContain("■ Validate the input")

    quiz.app.mockInput.pressTab({ shift: true })
    expect(await quiz.frame()).toContain("Question 1 of 3")
    expect(quiz.textarea.plainText).toBe("first")
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("skipping a multiple choice question leaves it unanswered", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path, mixed)

  try {
    quiz.app.mockInput.pressKey("s", { ctrl: true })
    quiz.app.mockInput.pressKey("2")
    quiz.app.mockInput.pressTab({ shift: true })
    quiz.app.mockInput.pressKey("s", { ctrl: true })
    quiz.app.mockInput.pressKey("s", { ctrl: true })

    expect(quiz.submitted).toEqual([[[], [], []]])
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("help opens for -h or --help on /learn-quiz, wherever the flag is", async () => {
  const { isQuizHelp } = await import("../../../src/routes/session/quiz")

  expect(isQuizHelp("/learn-quiz -h")).toBe(true)
  expect(isQuizHelp("/learn-quiz --help")).toBe(true)
  expect(isQuizHelp("  /learn-quiz src/app.ts --count 3 --help ")).toBe(true)

  expect(isQuizHelp("/learn-quiz")).toBe(false)
  expect(isQuizHelp("/learn-quiz src/app.ts --level beginner")).toBe(false)
  expect(isQuizHelp("/learn-quizzes -h")).toBe(false)
  expect(isQuizHelp("/review --help")).toBe(false)
  expect(isQuizHelp("what does /learn-quiz --help show?")).toBe(false)
})

test("help explains every option and the quiz keys", async () => {
  const { QUIZ_HELP } = await import("../../../src/routes/session/quiz")

  for (const option of ["file", "--diff", "--count <n>", "--level <level>", "--format <format>", "-h, --help"]) {
    expect(QUIZ_HELP).toContain(`  ${option} `)
  }
  expect(QUIZ_HELP).toContain("3 to 10 (default 5)")
  expect(QUIZ_HELP).toContain("beginner, intermediate, or advanced (default intermediate)")
  expect(QUIZ_HELP).toContain("mcq (multiple choice only), frq (free response only), or mixed (default mixed)")
  expect(QUIZ_HELP).toContain("With no file or --diff, the quiz covers your recent changes.")
  expect(QUIZ_HELP).toContain("enter next, shift+tab back, ctrl+s skip, ctrl+o hint, esc quit")
})

test("splitHint separates the hint from the question", async () => {
  const { splitHint } = await import("../../../src/routes/session/quiz")

  expect(splitHint("Why cents?\n\nHint: Try 0.1 + 0.2.")).toEqual({ question: "Why cents?", hint: "Try 0.1 + 0.2." })
  expect(splitHint("Why cents?\nhint:   Try 0.1 + 0.2.  ")).toEqual({ question: "Why cents?", hint: "Try 0.1 + 0.2." })
  expect(splitHint("Why cents?")).toEqual({ question: "Why cents?", hint: undefined })
  // "Hint:" only counts at the start of a line, so a question that mentions hints keeps its text.
  expect(splitHint("Is Hint: a good label here?")).toEqual({ question: "Is Hint: a good label here?", hint: undefined })
})

test("hints stay hidden until ctrl+o, and ctrl+o hides them again", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path, hinted)

  try {
    const frame = await quiz.frame()
    expect(frame).toContain("Why do you store prices in cents?")
    expect(frame).not.toContain("Try adding 0.1 and 0.2")
    expect(frame).toContain("ctrl+o hint")

    quiz.app.mockInput.pressKey("o", { ctrl: true })
    const shown = await quiz.frame()
    expect(shown).toContain("Hint: Try adding 0.1 and 0.2 as dollars.")
    expect(shown).toContain("ctrl+o hide hint")

    quiz.app.mockInput.pressKey("o", { ctrl: true })
    expect(await quiz.frame()).not.toContain("Try adding 0.1 and 0.2")
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("each question keeps its own hint state, including multiple choice", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path, hinted)

  try {
    quiz.app.mockInput.pressKey("o", { ctrl: true })
    await quiz.answer("floats round badly")
    quiz.app.mockInput.pressEnter()

    const second = await quiz.frame()
    expect(second).toContain("Question 2 of 3")
    expect(second).not.toContain("Look at what `splice` needs.")
    quiz.app.mockInput.pressKey("o", { ctrl: true })
    expect(await quiz.frame()).toContain("Hint: Look at what `splice` needs.")

    quiz.app.mockInput.pressTab({ shift: true })
    expect(await quiz.frame()).toContain("Hint: Try adding 0.1 and 0.2 as dollars.")
    expect(quiz.textarea.plainText).toBe("floats round badly")
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("questions without a hint show no hint key, and hints do not change the answers", async () => {
  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path, hinted)

  try {
    quiz.app.mockInput.pressKey("o", { ctrl: true })
    await quiz.answer("floats round badly")
    quiz.app.mockInput.pressEnter()
    quiz.app.mockInput.pressKey("1")

    const third = await quiz.frame()
    expect(third).toContain("Question 3 of 3")
    expect(third).not.toContain("ctrl+o")
    quiz.app.mockInput.pressKey("o", { ctrl: true })
    expect(await quiz.frame()).not.toContain("Hint:")

    await quiz.answer("zero")
    quiz.app.mockInput.pressEnter()
    expect(quiz.submitted).toEqual([[["floats round badly"], ["To remove by position"], ["zero"]]])
  } finally {
    quiz.app.renderer.destroy()
  }
})

test("multiple choice shows the answer text even when the label is only a letter", async () => {
  const { optionText } = await import("../../../src/routes/session/quiz")

  expect(optionText({ label: "Avoid a network call", description: "" })).toBe("Avoid a network call")
  expect(optionText({ label: "A", description: "Avoid a network call" })).toBe("Avoid a network call")
  expect(optionText({ label: "b)", description: "Sort the results" })).toBe("Sort the results")
  expect(optionText({ label: "E", description: "Retry the request" })).toBe("Retry the request")
  expect(optionText({ label: "F.", description: "Clear the cache" })).toBe("Clear the cache")
  expect(optionText({ label: "Cache", description: "Avoid a network call" })).toBe("Cache: Avoid a network call")

  await using tmp = await tmpdir()
  const quiz = await mountQuiz(tmp.path, {
    id: "que_letters",
    sessionID: "ses_quiz",
    questions: [
      { header: "Question 1", question: "Why did you cache the result?", options: [] },
      {
        header: "Question 2",
        question: "Why does `load` check the cache first?",
        options: ["Avoid a network call", "Sort the results", "Validate the input"].map((description, index) => ({
          label: "ABC"[index],
          description,
        })),
      },
    ],
  })

  try {
    await quiz.answer("to avoid repeat work")
    quiz.app.mockInput.pressEnter()

    const frame = await quiz.frame()
    expect(frame).toContain("□ Avoid a network call")
    expect(frame).toContain("□ Validate the input")
    expect(frame).not.toMatch(/[□■] [ABC]\s/)

    quiz.app.mockInput.pressArrow("down")
    quiz.app.mockInput.pressEnter()
    expect(quiz.submitted).toEqual([[["to avoid repeat work"], ["B"]]])
  } finally {
    quiz.app.renderer.destroy()
  }
})

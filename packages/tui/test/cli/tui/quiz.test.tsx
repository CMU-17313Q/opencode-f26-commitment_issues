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

async function wait(fn: () => boolean, timeout = 2000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error("timed out waiting for condition")
    await Bun.sleep(10)
  }
}

async function mountQuiz(root: string) {
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
                  request={request}
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

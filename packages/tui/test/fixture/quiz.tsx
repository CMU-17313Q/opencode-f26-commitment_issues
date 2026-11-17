/** @jsxImportSource @opentui/solid */
import { TextareaRenderable } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { onCleanup } from "solid-js"
import type { QuestionRequest } from "@opencode-ai/sdk/v2"
import { createTuiResolvedConfig } from "./tui-runtime"
import { TestTuiContexts } from "./tui-environment"

export async function wait(fn: () => boolean, timeout = 2000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error("timed out waiting for condition")
    await Bun.sleep(10)
  }
}

// Renders the /learn-quiz view on its own, recording what it submits and when it quits.
export async function mountQuiz(root: string, quiz: QuestionRequest) {
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
    import("../../src/routes/session/quiz"),
    import("../../src/context/kv"),
    import("../../src/context/theme"),
    import("../../src/config"),
    import("../../src/keymap"),
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

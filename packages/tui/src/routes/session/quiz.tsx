import { createStore } from "solid-js/store"
import { createSignal, onCleanup, onMount, Show } from "solid-js"
import { TextAttributes, type TextareaRenderable } from "@opentui/core"
import type { QuestionRequest } from "@opencode-ai/sdk/v2"
import { useTheme } from "../../context/theme"
import { SplitBorder } from "../../ui/border"
import { useTuiConfig } from "../../config"
import { useBindings, useOpencodeModeStack } from "../../keymap"

const QUIZ_MODE = "quiz"

// Interactive view for /learn-quiz: one free-text question at a time, replacing the generic question picker.
export function QuizPrompt(props: {
  request: QuestionRequest
  onSubmit: (answers: string[][]) => void
  onQuit: () => void
}) {
  const { theme } = useTheme()
  const tuiConfig = useTuiConfig()
  const modeStack = useOpencodeModeStack()
  const [textarea, setTextarea] = createSignal<TextareaRenderable>()
  const [store, setStore] = createStore({
    index: 0,
    answers: props.request.questions.map(() => ""),
  })

  const total = () => props.request.questions.length
  const last = () => store.index === total() - 1

  // Every move saves the current draft first so answers survive navigating back and forth.
  function move(index: number, answer = textarea()?.plainText ?? "") {
    setStore("answers", store.index, answer)
    if (index >= total()) {
      props.onSubmit(store.answers.map((value) => (value.trim() ? [value.trim()] : [])))
      return
    }
    setStore("index", index)
    textarea()?.setText(store.answers[index])
    textarea()?.gotoBufferEnd()
  }

  onMount(() => {
    const popMode = modeStack.push(QUIZ_MODE)
    onCleanup(popMode)
  })

  useBindings(() => ({
    mode: QUIZ_MODE,
    target: textarea,
    enabled: textarea() !== undefined,
    // Quiz navigation must win over the managed textarea input layer, which would otherwise consume these keys.
    priority: 1,
    commands: [
      {
        name: "app.exit",
        title: "Quit quiz",
        category: "Quiz",
        run: () => props.onQuit(),
      },
    ],
    bindings: [
      { key: "return", desc: "Next question", group: "Quiz", cmd: () => move(store.index + 1) },
      { key: "tab", desc: "Next question", group: "Quiz", cmd: () => move(store.index + 1) },
      {
        key: "shift+tab",
        desc: "Previous question",
        group: "Quiz",
        cmd: () => {
          if (store.index === 0) return
          move(store.index - 1)
        },
      },
      { key: "ctrl+s", desc: "Skip question", group: "Quiz", cmd: () => move(store.index + 1, "") },
      { key: "escape", desc: "Quit quiz", group: "Quiz", cmd: () => props.onQuit() },
      ...tuiConfig.keybinds.get("app.exit"),
    ],
  }))

  return (
    <box
      backgroundColor={theme.backgroundPanel}
      border={["left"]}
      borderColor={theme.accent}
      customBorderChars={SplitBorder.customBorderChars}
      onMouseUp={() => textarea()?.focus()}
    >
      <box gap={1} paddingLeft={2} paddingRight={3} paddingTop={1} paddingBottom={1}>
        <box flexDirection="row" justifyContent="space-between">
          <text attributes={TextAttributes.BOLD} fg={theme.text}>
            Quiz
          </text>
          <text fg={theme.textMuted}>
            Question {store.index + 1} of {total()}
          </text>
        </box>
        <text fg={theme.text}>{props.request.questions[store.index]?.question}</text>
        <textarea
          ref={(val: TextareaRenderable) => {
            setTextarea(val)
            val.traits = { status: "ANSWER" }
            queueMicrotask(() => val.focus())
          }}
          placeholder="Type your answer"
          placeholderColor={theme.textMuted}
          minHeight={1}
          maxHeight={6}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.primary}
          cursorStyle={tuiConfig.cursor}
        />
      </box>
      <box flexDirection="row" flexShrink={0} gap={2} paddingLeft={2} paddingRight={3} paddingBottom={1}>
        <text fg={theme.text}>
          enter <span style={{ fg: theme.textMuted }}>{last() ? "submit" : "next"}</span>
        </text>
        <Show when={store.index > 0}>
          <text fg={theme.text}>
            shift+tab <span style={{ fg: theme.textMuted }}>back</span>
          </text>
        </Show>
        <text fg={theme.text}>
          ctrl+s <span style={{ fg: theme.textMuted }}>skip</span>
        </text>
        <text fg={theme.text}>
          esc <span style={{ fg: theme.textMuted }}>quit</span>
        </text>
      </box>
    </box>
  )
}

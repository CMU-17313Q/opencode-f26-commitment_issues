import { createStore } from "solid-js/store"
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { TextAttributes, type TextareaRenderable } from "@opentui/core"
import type { QuestionRequest } from "@opencode-ai/sdk/v2"
import { useTheme } from "../../context/theme"
import { SplitBorder } from "../../ui/border"
import { useTuiConfig } from "../../config"
import { useBindings, useOpencodeModeStack } from "../../keymap"

const QUIZ_MODE = "quiz"

// Keep in sync with the argument parser in packages/opencode/src/command/learn-quiz.ts.
export const QUIZ_HELP = [
  "Quiz yourself on your own code, one question at a time.",
  "",
  "Usage: /learn-quiz [file | --diff] [--count <3-10>] [--level <level>] [--format <format>]",
  "",
  "  file               Quiz on one file, e.g. src/app.ts",
  "  --diff             Quiz on your uncommitted changes",
  "  --count <n>        Number of questions, 3 to 10 (default 5)",
  "  --level <level>    beginner, intermediate, or advanced (default intermediate)",
  "  --format <format>  mcq (multiple choice only), frq (free response only), or mixed (default mixed)",
  "  -h, --help         Show this help",
  "",
  "With no file or --diff, the quiz covers your recent changes.",
  "",
  "In the quiz: enter next, shift+tab back, ctrl+s skip, esc quit.",
  "Multiple choice: up/down or 1-9 to choose.",
].join("\n")

// True for `/learn-quiz -h` or `--help`, wherever the flag appears, so the TUI can answer without a model call.
export function isQuizHelp(input: string) {
  const [command, ...args] = input.trim().split(/\s+/)
  return command === "/learn-quiz" && args.some((arg) => arg === "-h" || arg === "--help")
}

// Interactive view for /learn-quiz: one question at a time, replacing the generic question picker.
// Questions with options are multiple choice; questions without options take a typed answer.
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
    cursor: 0,
    answers: props.request.questions.map(() => ""),
  })

  const total = () => props.request.questions.length
  const last = () => store.index === total() - 1
  const options = () => props.request.questions[store.index]?.options ?? []
  const choice = () => options().length > 0

  // Every move saves the current answer first so answers survive navigating back and forth.
  function move(index: number, answer = choice() ? store.answers[store.index] : (textarea()?.plainText ?? "")) {
    setStore("answers", store.index, answer)
    if (index >= total()) {
      props.onSubmit(store.answers.map((value) => (value.trim() ? [value.trim()] : [])))
      return
    }
    setStore("index", index)
    setStore(
      "cursor",
      Math.max(
        options().findIndex((option) => option.label === store.answers[index]),
        0,
      ),
    )
    textarea()?.setText(store.answers[index])
    textarea()?.gotoBufferEnd()
  }

  function back() {
    if (store.index === 0) return
    move(store.index - 1)
  }

  function pick(index: number) {
    const option = options()[index]
    if (!option) return
    move(store.index + 1, option.label)
  }

  onMount(() => {
    const popMode = modeStack.push(QUIZ_MODE)
    onCleanup(popMode)
  })

  // The textarea only takes keys on typed-answer questions; multiple choice is driven by the choice bindings.
  createEffect(() => {
    const input = textarea()
    if (!input) return
    if (choice()) {
      input.blur()
      return
    }
    // Focus right away so a key pressed straight after leaving a multiple choice question is not lost.
    input.focus()
  })

  const navigation = () => [
    { key: "tab", desc: "Next question", group: "Quiz", cmd: () => move(store.index + 1) },
    { key: "shift+tab", desc: "Previous question", group: "Quiz", cmd: back },
    { key: "ctrl+s", desc: "Skip question", group: "Quiz", cmd: () => move(store.index + 1, "") },
    { key: "escape", desc: "Quit quiz", group: "Quiz", cmd: () => props.onQuit() },
    ...tuiConfig.keybinds.get("app.exit"),
  ]
  const commands = [{ name: "app.exit", title: "Quit quiz", category: "Quiz", run: () => props.onQuit() }]

  useBindings(() => ({
    mode: QUIZ_MODE,
    target: textarea,
    enabled: textarea() !== undefined && !choice(),
    // Quiz navigation must win over the managed textarea input layer, which would otherwise consume these keys.
    priority: 1,
    commands,
    bindings: [
      { key: "return", desc: "Next question", group: "Quiz", cmd: () => move(store.index + 1) },
      ...navigation(),
    ],
  }))

  useBindings(() => ({
    mode: QUIZ_MODE,
    enabled: choice(),
    commands,
    bindings: [
      { key: "return", desc: "Choose answer", group: "Quiz", cmd: () => pick(store.cursor) },
      {
        key: "up",
        desc: "Previous answer",
        group: "Quiz",
        cmd: () => setStore("cursor", (store.cursor - 1 + options().length) % options().length),
      },
      {
        key: "down",
        desc: "Next answer",
        group: "Quiz",
        cmd: () => setStore("cursor", (store.cursor + 1) % options().length),
      },
      ...options()
        .slice(0, 9)
        .map((_, index) => ({
          key: String(index + 1),
          desc: `Choose answer ${index + 1}`,
          group: "Quiz",
          cmd: () => pick(index),
        })),
      ...navigation(),
    ],
  }))

  return (
    <box
      backgroundColor={theme.backgroundPanel}
      border={["left"]}
      borderColor={theme.accent}
      customBorderChars={SplitBorder.customBorderChars}
      onMouseUp={() => {
        if (!choice()) textarea()?.focus()
      }}
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
        <Show when={choice()}>
          <box>
            <For each={options()}>
              {(option, index) => {
                const active = () => index() === store.cursor
                const chosen = () => store.answers[store.index] === option.label
                return (
                  <box
                    flexDirection="row"
                    backgroundColor={active() ? theme.backgroundElement : undefined}
                    onMouseOver={() => setStore("cursor", index())}
                    onMouseUp={() => pick(index())}
                  >
                    <text fg={active() ? theme.secondary : theme.text}>
                      {`${chosen() ? "■" : "□"} ${option.label}`}
                    </text>
                  </box>
                )
              }}
            </For>
          </box>
        </Show>
        <textarea
          ref={(val: TextareaRenderable) => {
            setTextarea(val)
            val.traits = { status: "ANSWER" }
          }}
          visible={!choice()}
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
        <Show when={choice()}>
          <text fg={theme.text}>
            {"↑↓"} <span style={{ fg: theme.textMuted }}>select</span>
          </text>
        </Show>
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

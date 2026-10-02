import "./focus-session.css"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { createStore } from "solid-js/store"
import { For, Match, Show, Switch, createMemo, onCleanup, onMount } from "solid-js"
import { ServerConnection } from "@/context/server"
import { useTabs } from "@/context/tabs"
import { Persist, persisted } from "@/utils/persist"
import type { HomeController } from "../home-controller"
import { FocusLockOverlay } from "./components/lock-overlay"
import { FocusStatusBar } from "./components/status-bar"
import { formatRemaining } from "./controller/format"
import { buildHelpPrompt, requestHelp } from "./controller/help-prompt"
import { type FocusHistoryRecord, appendHistory, summarizeHistory } from "./controller/history"
import type { ActivityStatus } from "./controller/idle-monitor"
import { FOCUS_PRESETS, type FocusPresetID, resolveTiming } from "./controller/presets"
import type { FocusSnapshot } from "./controller/session-controller"
import { focusCopy } from "./copy"
import { focusSession } from "./session-store"

const ACTIVITY_THROTTLE_MS = 1_000
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel"] as const

export function FocusSessionCard(props: { home: HomeController }) {
  const session = focusSession()
  const tabs = useTabs()
  const [prefs, setPrefs] = persisted(
    Persist.global("focus-session.v1"),
    createStore({
      preset: "pomodoro" as FocusPresetID,
      workMinutes: "25",
      breakMinutes: "5",
      history: [] as FocusHistoryRecord[],
    }),
  )
  const [view, setView] = createStore({
    snapshot: session.controller.snapshot(),
    status: session.monitor.status() as ActivityStatus,
    error: "",
    help: "idle" as "idle" | "sending" | "no-project" | "failed",
    celebrate: false,
  })

  const stopController = session.controller.subscribe((event, snapshot: FocusSnapshot) => {
    setView("snapshot", snapshot)
    if (event.type === "work-complete") setView("celebrate", true)
    if (event.type === "phase" && event.phase === "work") setView({ celebrate: false, help: "idle" })
    if (event.type === "ended") setView({ celebrate: false, help: "idle" })
  })
  const stopMonitor = session.monitor.subscribe((event) => {
    if (event.type === "status") setView("status", event.status)
  })
  const stopRecord = session.onRecord((record) => setPrefs("history", (list) => appendHistory(list, record)))
  onCleanup(() => {
    stopController()
    stopMonitor()
    stopRecord()
  })

  // Any input counts as activity; throttled so mouse moves don't reset timers constantly.
  onMount(() => {
    const last = { at: 0 }
    const onActivity = () => {
      const now = session.clock.now()
      if (now - last.at < ACTIVITY_THROTTLE_MS) return
      last.at = now
      session.monitor.activity()
    }
    ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, onActivity, { passive: true, capture: true }))
    onCleanup(() => ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, onActivity, { capture: true })))
  })

  const summary = createMemo(() => summarizeHistory(prefs.history))
  const phase = () => view.snapshot.phase
  const checkIn = () => phase() === "work" && (view.status === "idle" || view.status === "unresponsive")

  const start = () => {
    const result = resolveTiming(prefs.preset, { workMinutes: prefs.workMinutes, breakMinutes: prefs.breakMinutes })
    if (!result.ok) return setView("error", result.error)
    setView("error", "")
    session.controller.start({ timing: result.timing, volume: 1 })
  }

  const askForHelp = async () => {
    session.monitor.answer(true)
    setView("help", "sending")
    const conn = props.home.server.focused()
    const ctx = props.home.server.focusedContext()
    const directory = props.home.project.newSession()?.worktree
    const snapshot = session.controller.snapshot()
    const text = buildHelpPrompt({
      round: snapshot.round,
      workMinutes: snapshot.timing?.workMinutes ?? 0,
      minutesLeft: Math.ceil(snapshot.remainingMs / 60_000),
    })
    if (!conn || !ctx) return setView("help", "failed")
    const result = await requestHelp(ctx.sdk.client, directory, text)
    if (!result.ok) return setView("help", result.reason)
    setView("help", "idle")
    session.controller.releaseLock()
    if (directory) ctx.projects.open(directory)
    tabs.select(tabs.addSessionTab({ server: ServerConnection.key(conn), sessionId: result.sessionID }))
  }

  const ActivePanel = () => (
    <div class="focus-active">
      <div class="focus-active__header">
        <span class="focus-active__phase">
          {view.snapshot.paused ? focusCopy.paused : phase() === "work" ? focusCopy.working : focusCopy.onBreak}
        </span>
        <span class="focus-active__round">{focusCopy.round(view.snapshot.round)}</span>
      </div>
      <div class="focus-active__time" role="timer" aria-live="off">
        {formatRemaining(view.snapshot.remainingMs)}
      </div>
      <FocusStatusBar status={view.status} />
      <Show when={view.celebrate && phase() === "break"}>
        <p class="focus-message">{focusCopy.workComplete}</p>
      </Show>
      <Show when={phase() === "work" && !view.snapshot.locked}>
        <p class="focus-message">{focusCopy.unlockedNotice}</p>
      </Show>
      <Show when={checkIn()}>
        <div class="focus-checkin" role="alertdialog" aria-label={focusCopy.checkIn}>
          <strong>{focusCopy.checkIn}</strong>
          <span>{focusCopy.checkInHint}</span>
          <div class="focus-row">
            <ButtonV2 variant="contrast" onClick={() => void askForHelp()} disabled={view.help === "sending"}>
              {focusCopy.yes}
            </ButtonV2>
            <ButtonV2 variant="ghost" onClick={() => session.monitor.answer(false)}>
              {focusCopy.no}
            </ButtonV2>
          </div>
        </div>
      </Show>
      <Switch>
        <Match when={view.help === "sending"}>
          <p class="focus-message">{focusCopy.helpSending}</p>
        </Match>
        <Match when={view.help === "no-project"}>
          <p class="focus-message focus-message--error">{focusCopy.helpNoProject}</p>
        </Match>
        <Match when={view.help === "failed"}>
          <p class="focus-message focus-message--error">{focusCopy.helpFailed}</p>
        </Match>
      </Switch>
      <div class="focus-row">
        <Show
          when={view.snapshot.paused}
          fallback={<ButtonV2 onClick={() => session.controller.pause()}>{focusCopy.pause}</ButtonV2>}
        >
          <ButtonV2 onClick={() => session.controller.resume()}>{focusCopy.resume}</ButtonV2>
        </Show>
        <ButtonV2 variant="danger" onClick={() => session.controller.end()}>
          {focusCopy.end}
        </ButtonV2>
      </div>
    </div>
  )

  return (
    <section class="focus-card" aria-label={focusCopy.title} data-phase={phase()}>
      <header class="focus-card__header">
        <h2 class="focus-card__title">{focusCopy.title}</h2>
        <Show when={summary().sessions > 0}>
          <span class="focus-card__history">{focusCopy.history(summary().sessions, summary().focusMinutes)}</span>
        </Show>
      </header>
      <Switch>
        <Match when={phase() === "idle"}>
          <p class="focus-card__subtitle">{focusCopy.subtitle}</p>
          <fieldset class="focus-field">
            <legend>{focusCopy.timing}</legend>
            <div class="focus-row" role="radiogroup" aria-label={focusCopy.timing}>
              <For each={[...FOCUS_PRESETS, { id: "custom" as const, label: focusCopy.presetCustom }]}>
                {(item) => (
                  <button
                    type="button"
                    role="radio"
                    class="focus-chip"
                    aria-checked={prefs.preset === item.id}
                    onClick={() => setPrefs("preset", item.id)}
                  >
                    {item.label}
                  </button>
                )}
              </For>
            </div>
            <Show when={prefs.preset === "custom"}>
              <div class="focus-row">
                <label class="focus-input">
                  <span>{focusCopy.workMinutes}</span>
                  <input
                    type="number"
                    inputmode="numeric"
                    min="1"
                    max="120"
                    step="1"
                    value={prefs.workMinutes}
                    onInput={(event) => setPrefs("workMinutes", event.currentTarget.value)}
                  />
                </label>
                <label class="focus-input">
                  <span>{focusCopy.breakMinutes}</span>
                  <input
                    type="number"
                    inputmode="numeric"
                    min="0"
                    max="60"
                    step="1"
                    value={prefs.breakMinutes}
                    onInput={(event) => setPrefs("breakMinutes", event.currentTarget.value)}
                  />
                </label>
              </div>
            </Show>
          </fieldset>
          <Show when={view.error}>
            <p class="focus-message focus-message--error" role="alert">
              {view.error}
            </p>
          </Show>
          <ButtonV2 variant="contrast" size="large" onClick={start}>
            {focusCopy.start}
          </ButtonV2>
        </Match>
        <Match when={phase() === "break-ended"}>
          <p class="focus-message">{focusCopy.breakEnded}</p>
          <div class="focus-row">
            <ButtonV2 variant="contrast" onClick={() => session.controller.nextRound()}>
              {focusCopy.anotherRound}
            </ButtonV2>
            <ButtonV2 onClick={() => session.controller.finish()}>{focusCopy.done}</ButtonV2>
          </div>
        </Match>
        <Match when={view.snapshot.locked}>
          <p class="focus-message">{focusCopy.lockedNotice}</p>
          <FocusLockOverlay>
            <div class="focus-card focus-card--floating">
              <ActivePanel />
            </div>
          </FocusLockOverlay>
        </Match>
        <Match when={true}>
          <ActivePanel />
        </Match>
      </Switch>
    </section>
  )
}

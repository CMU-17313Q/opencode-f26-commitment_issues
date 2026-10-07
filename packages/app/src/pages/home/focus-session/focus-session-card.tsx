import "./focus-session.css"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { For, Show, createMemo, createSignal, onCleanup } from "solid-js"
import { usePlatform } from "@/context/platform"
import { ServerConnection } from "@/context/server"
import { type Tab, tabHref, tabKey, useTabs } from "@/context/tabs"
import type { HomeController } from "../home-controller"
import { FocusActivePanel } from "./components/active-panel"
import { requestHelp } from "./controller/help-prompt"
import { summarizeHistory } from "./controller/history"
import { FOCUS_PRESETS, resolveTiming } from "./controller/presets"
import type { GuardTab } from "./controller/tab-guard"
import { focusCopy } from "./copy"
import { focusSession } from "./session-store"

export function FocusSessionCard(props: { home: HomeController }) {
  const session = focusSession()
  const tabs = useTabs()
  const find = (key: string) => tabs.store.findIndex((tab) => tabKey(tab) === key)
  session.connect(usePlatform(), {
    hasProject: () => !!props.home.server.focused() && !!props.home.project.newSession(),
    tabs: () => tabs.store.map(toGuardTab),
    select: (key) => {
      const tab = tabs.store[find(key)]
      if (tab) tabs.select(tab)
    },
    remove: (key) => {
      const index = find(key)
      if (index !== -1) tabs.removeTab(index)
    },
    openStudyTab: async () => {
      const conn = props.home.server.focused()
      const project = props.home.project.newSession()
      if (!conn || !project) return undefined
      const tab = await tabs.newDraft({ server: ServerConnection.key(conn), directory: project.worktree })
      return { key: tabKey(tab), directory: project.worktree, draftID: tab.draftID }
    },
    promote: (draftID, sessionID) => {
      const conn = props.home.server.focused()
      if (conn) tabs.promoteDraft(draftID, { server: ServerConnection.key(conn), sessionId: sessionID })
    },
    sendHelp: (target, text) => {
      const ctx = props.home.server.focusedContext()
      if (!ctx) return Promise.resolve({ ok: false, reason: "failed" })
      return requestHelp(ctx.sdk.client, target, text)
    },
  })
  session.cardMounted(1)
  onCleanup(() => session.cardMounted(-1))

  const [error, setError] = createSignal("")
  const prefs = session.prefs()
  const summary = createMemo(() => summarizeHistory(prefs.history))

  const start = () => {
    const result = resolveTiming(prefs.preset, { workMinutes: prefs.workMinutes, breakMinutes: prefs.breakMinutes })
    if (!result.ok) return setError(result.error)
    setError(session.start(result.timing))
  }

  return (
    <section class="focus-card" aria-label={focusCopy.title}>
      <header class="focus-card__header">
        <h2 class="focus-card__title">{focusCopy.title}</h2>
        <Show when={summary().sessions > 0}>
          <span class="focus-card__muted">
            {focusCopy.history(summary().sessions, summary().focusMinutes)}
            <Show when={summary().averageFocus !== undefined}>
              {` · ${focusCopy.averageFocus(summary().averageFocus ?? 0)}`}
            </Show>
          </span>
        </Show>
      </header>
      <Show when={session.view.snapshot.phase === "idle"} fallback={<FocusActivePanel session={session} />}>
        <p class="focus-card__muted">{focusCopy.subtitle}</p>
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
                  onClick={() => session.setPrefs("preset", item.id)}
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
                  onInput={(event) => session.setPrefs("workMinutes", event.currentTarget.value)}
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
                  onInput={(event) => session.setPrefs("breakMinutes", event.currentTarget.value)}
                />
              </label>
            </div>
          </Show>
        </fieldset>
        <Show when={error()}>
          <p class="focus-message" data-tone="error" role="alert">
            {error()}
          </p>
        </Show>
        <ButtonV2 variant="contrast" size="large" onClick={start}>
          {focusCopy.start}
        </ButtonV2>
      </Show>
    </section>
  )
}

function toGuardTab(tab: Tab): GuardTab {
  return {
    key: tabKey(tab),
    href: tabHref(tab),
    draftID: tab.type === "draft" ? tab.draftID : undefined,
    sessionID: tab.type === "session" ? tab.sessionId : undefined,
  }
}

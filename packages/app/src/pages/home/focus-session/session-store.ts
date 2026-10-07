import { createComponent, createRoot } from "solid-js"
import { createStore } from "solid-js/store"
import { render } from "solid-js/web"
import type { Platform } from "@/context/platform"
import { Persist, persisted } from "@/utils/persist"
import { FocusFloatingPanel } from "./components/floating-panel"
import { buildHelpPrompt, type HelpResult } from "./controller/help-prompt"
import { type FocusHistoryRecord, appendHistory, trackHistory } from "./controller/history"
import { createFocusTracker, followFocus, workElapsedMs } from "./controller/focus-score"
import { createFocusTimeline, layoutTimeline } from "./controller/focus-timeline"
import { type ActivityStatus, createIdleMonitor, followSession } from "./controller/idle-monitor"
import { silentAudio, systemClock } from "./controller/ports"
import type { FocusPresetID, FocusTiming } from "./controller/presets"
import { createFocusSessionController } from "./controller/session-controller"
import { type GuardTab, type TabLock, planTabGuard } from "./controller/tab-guard"
import { focusCopy } from "./copy"

// What the session needs from the app (tabs, SDK). Registered by the home card, which is
// where those contexts are available; kept after it unmounts.
export type FocusAppBridge = {
  hasProject(): boolean
  tabs(): GuardTab[]
  select(key: string): void
  remove(key: string): void
  openStudyTab(): Promise<StudyTab | undefined>
  promote(draftID: string, sessionID: string): void
  sendHelp(target: { directory: string; sessionID?: string }, text: string): Promise<HelpResult>
}

export type StudyTab = { key: string; directory: string; draftID?: string }

const ACTIVITY_THROTTLE_MS = 1_000
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel"] as const
const BLOCKED_NOTICE_MS = 4_000

const defaultPrefs = {
  preset: "pomodoro" as FocusPresetID,
  workMinutes: "25",
  breakMinutes: "5",
  history: [] as FocusHistoryRecord[],
}

// One session per app window, kept at module level so it survives navigating between pages.
function createFocusSession() {
  const clock = systemClock
  // Real music (Howler) is wired in with #19; until then "No music" behaviour is used.
  const controller = createFocusSessionController({ clock, audio: silentAudio })
  const monitor = createIdleMonitor({ clock })
  followSession(controller, monitor)
  const tracker = createFocusTracker({ clock })
  const timeline = createFocusTimeline()
  followFocus(controller, monitor, tracker, timeline)
  // Snapshot of the score and the current round's colored timeline, for the view.
  const focusView = () => {
    const snapshot = controller.snapshot()
    const totalMs = (snapshot.timing?.workMinutes ?? 0) * 60_000
    const elapsedMs = snapshot.phase === "work" ? workElapsedMs(snapshot) : totalMs
    return { ...tracker.snapshot(), timeline: layoutTimeline(timeline.segments(), elapsedMs, totalMs) }
  }

  const [view, setView] = createStore({
    snapshot: controller.snapshot(),
    focus: focusView(),
    fullscreen: false,
    status: monitor.status() as ActivityStatus,
    help: "idle" as "idle" | "sending" | "no-project" | "failed",
    celebrate: false,
    blockedAt: 0,
    cardsMounted: 0,
  })
  const app = {
    bridge: undefined as FocusAppBridge | undefined,
    prefs: undefined as ReturnType<typeof createPrefs> | undefined,
    pending: [] as FocusHistoryRecord[],
    study: undefined as StudyTab | undefined,
    lock: undefined as TabLock | undefined,
    reopening: false,
  }

  const saveRecord = (record: FocusHistoryRecord) => {
    if (!app.prefs) return app.pending.push(record)
    app.prefs[1]("history", (list) => appendHistory(list, record))
  }
  trackHistory({ clock, controller, monitor, save: saveRecord, focus: () => tracker.snapshot() })

  const lockToStudyTab = () => {
    const bridge = app.bridge
    const study = app.study
    if (!bridge || !study) return
    app.lock = {
      focusKey: study.key,
      baseline: bridge
        .tabs()
        .map((tab) => tab.key)
        .filter((key) => key !== study.key),
    }
    enforceLock()
  }

  // Keep the student in the study tab: close tabs opened during work and navigate back.
  const enforceLock = () => {
    const bridge = app.bridge
    const lock = app.lock
    if (!bridge || !lock || !controller.snapshot().locked) return
    const plan = planTabGuard({
      lock,
      tabs: bridge.tabs(),
      location: { pathname: window.location.pathname, search: window.location.search },
    })
    if (!plan.focus) return reopenStudyTab(bridge, lock)
    if (plan.focus.key !== lock.focusKey && app.study) {
      app.lock = { ...lock, focusKey: plan.focus.key }
      app.study = { key: plan.focus.key, directory: app.study.directory }
    }
    plan.remove.forEach((key) => bridge.remove(key))
    if (plan.navigate) bridge.select(plan.focus.key)
    if (plan.blocked) setView("blockedAt", clock.now())
  }

  const reopenStudyTab = (bridge: FocusAppBridge, lock: TabLock) => {
    if (app.reopening) return
    app.reopening = true
    void bridge.openStudyTab().then((study) => {
      app.reopening = false
      if (!study) return
      app.study = study
      app.lock = { ...lock, focusKey: study.key }
    })
  }

  controller.subscribe((event, snapshot) => {
    setView({ snapshot, focus: focusView() })
    if (event.type === "tick") return enforceLock()
    if (event.type === "work-complete") setView("celebrate", true)
    if (event.type === "ended" || (event.type === "phase" && event.phase === "idle")) {
      setView({ celebrate: false, help: "idle" })
      app.study = undefined
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    }
    if (event.type === "phase" && event.phase === "work") {
      setView({ celebrate: false, help: "idle" })
      lockToStudyTab()
      return
    }
    if (snapshot.locked) return
    app.lock = undefined
    setView("blockedAt", 0)
  })
  monitor.subscribe((event) => {
    if (event.type === "status") setView({ status: event.status, focus: focusView() })
  })

  // Any input counts as activity (throttled); leaving the tab or window counts as being away.
  const last = { at: 0 }
  const onActivity = () => {
    const now = clock.now()
    if (now - last.at < ACTIVITY_THROTTLE_MS) return
    last.at = now
    monitor.activity()
  }
  ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, onActivity, { passive: true, capture: true }))
  // A web page cannot block other apps or browser tabs; it can only notice and record leaving.
  const setAway = (away: boolean) => {
    if (away) monitor.away()
    tracker.setAway(away)
  }
  document.addEventListener("visibilitychange", () => setAway(document.hidden))
  window.addEventListener("blur", () => setAway(true))
  window.addEventListener("focus", () => setAway(false))
  document.addEventListener("fullscreenchange", () => setView("fullscreen", !!document.fullscreenElement))

  // The floating panel lives outside the router so it stays visible on every page.
  const host = document.createElement("div")
  host.dataset.component = "focus-session-floating"
  document.body.append(host)

  const session = {
    clock,
    controller,
    monitor,
    view,
    prefs: () => app.prefs?.[0] ?? defaultPrefs,
    setPrefs: <K extends keyof typeof defaultPrefs>(key: K, value: (typeof defaultPrefs)[K]) =>
      app.prefs?.[1](key, value as never),
    // Called by the home card with the app contexts it has access to.
    connect(platform: Platform, bridge: FocusAppBridge) {
      app.bridge = bridge
      if (!app.prefs) app.prefs = createPrefs(platform)
      app.pending.splice(0).forEach(saveRecord)
    },
    cardMounted(delta: 1 | -1) {
      setView("cardsMounted", (count) => count + delta)
    },
    // Starts the timer synchronously (music must start inside the click handler for autoplay),
    // then opens the study tab and locks the student into it.
    start(timing: FocusTiming) {
      const bridge = app.bridge
      if (!bridge?.hasProject()) return focusCopy.needProject
      const baseline = bridge.tabs().map((tab) => tab.key)
      app.study = undefined
      app.lock = undefined
      controller.start({ timing, volume: 1 })
      session.enterFullscreen()
      void bridge.openStudyTab().then((study) => {
        if (!study) return
        app.study = study
        app.lock = { focusKey: study.key, baseline }
      })
      return ""
    },
    // Must run inside a click handler (browsers only allow full screen after a user gesture).
    enterFullscreen() {
      if (document.fullscreenElement) return
      void document.documentElement.requestFullscreen?.()?.catch(() => undefined)
    },
    async askForHelp() {
      if (!monitor.answer(true)) return
      const bridge = app.bridge
      const study = app.study
      if (!bridge || !study) return setView("help", "no-project")
      setView("help", "sending")
      const snapshot = controller.snapshot()
      const text = buildHelpPrompt({
        round: snapshot.round,
        workMinutes: snapshot.timing?.workMinutes ?? 0,
        minutesLeft: Math.ceil(snapshot.remainingMs / 60_000),
      })
      const tab = bridge.tabs().find((item) => item.key === study.key)
      const result = await bridge.sendHelp({ directory: study.directory, sessionID: tab?.sessionID }, text)
      if (!result.ok) return setView("help", result.reason)
      setView("help", "idle")
      // The study tab was still a draft: turn it into the new session so the answer shows there.
      if (tab?.draftID) bridge.promote(tab.draftID, result.sessionID)
    },
    message: () => {
      if (view.help === "sending") return focusCopy.helpSending
      if (view.help === "no-project") return focusCopy.helpNoProject
      if (view.help === "failed") return focusCopy.helpFailed
      if (view.blockedAt && view.snapshot.locked && clock.now() - view.blockedAt < BLOCKED_NOTICE_MS)
        return focusCopy.tabsLocked
      return ""
    },
  }
  render(() => createComponent(FocusFloatingPanel, { session }), host)
  return session
}

// Saved choices and history, owned by the session (not the card) so a session ended from
// another page is still recorded. Uses the app's existing persisted storage.
function createPrefs(platform: Platform) {
  return createRoot(() => {
    const [store, setStore] = persisted(Persist.global("focus-session.v1"), createStore({ ...defaultPrefs }), platform)
    return [store, setStore] as const
  })
}

export type FocusSession = ReturnType<typeof createFocusSession>

const state = { session: undefined as FocusSession | undefined }

export function focusSession() {
  if (!state.session) state.session = createFocusSession()
  return state.session
}

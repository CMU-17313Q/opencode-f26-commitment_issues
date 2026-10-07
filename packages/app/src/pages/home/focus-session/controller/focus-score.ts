import type { FocusTimeline } from "./focus-timeline"
import type { ActivityStatus, IdleMonitor } from "./idle-monitor"
import type { Clock } from "./ports"
import type { FocusSessionController, FocusSnapshot as FocusSessionSnapshot } from "./session-controller"

// green = focused, yellow = distracted, red = not focused
export type FocusBand = "focused" | "distracted" | "unfocused"

// Highest band first; a score belongs to the first band whose minimum it reaches.
export const FOCUS_BANDS: ReadonlyArray<{ id: FocusBand; min: number }> = [
  { id: "focused", min: 70 },
  { id: "distracted", min: 40 },
  { id: "unfocused", min: 0 },
]

export type FocusSnapshot = {
  score: number
  band: FocusBand
  focusedMs: number
  trackedMs: number
  awayMs: number
}

export function focusBand(score: number): FocusBand {
  return FOCUS_BANDS.find((band) => score >= band.min)?.id ?? "unfocused"
}

// Measures how much of the tracked work time the student was focused (green status).
// Time is only tracked while the idle monitor is tracking: unpaused work periods.
export function createFocusTracker(deps: { clock: Clock }) {
  const totals = { active: 0, idle: 0, unresponsive: 0, away: 0 }
  const open = {
    status: undefined as Exclude<ActivityStatus, "neutral"> | undefined,
    since: 0,
    awaySince: undefined as number | undefined,
  }

  const closeAway = () => {
    if (open.awaySince === undefined) return
    totals.away += deps.clock.now() - open.awaySince
    open.awaySince = undefined
  }

  const close = () => {
    if (open.status) totals[open.status] += deps.clock.now() - open.since
    open.status = undefined
  }

  return {
    mark(status: ActivityStatus) {
      close()
      if (status === "neutral") return closeAway()
      open.status = status
      open.since = deps.clock.now()
    },
    setAway(away: boolean) {
      if (!away) return closeAway()
      if (open.status && open.awaySince === undefined) open.awaySince = deps.clock.now()
    },
    reset() {
      Object.assign(totals, { active: 0, idle: 0, unresponsive: 0, away: 0 })
      Object.assign(open, { status: undefined, since: 0, awaySince: undefined })
    },
    snapshot(): FocusSnapshot {
      const now = deps.clock.now()
      const running = open.status ? now - open.since : 0
      const focusedMs = totals.active + (open.status === "active" ? running : 0)
      const trackedMs = totals.active + totals.idle + totals.unresponsive + running
      const awayMs = totals.away + (open.awaySince === undefined ? 0 : now - open.awaySince)
      const score = trackedMs === 0 ? 100 : Math.round((focusedMs / trackedMs) * 100)
      return { score, band: focusBand(score), focusedMs, trackedMs, awayMs }
    },
  }
}

export type FocusTracker = ReturnType<typeof createFocusTracker>

export function workElapsedMs(snapshot: FocusSessionSnapshot) {
  return (snapshot.timing?.workMinutes ?? 0) * 60_000 - snapshot.remainingMs
}

// Score covers the whole session (all rounds); it restarts when a new session starts.
// The timeline covers one round; it restarts every work round.
export function followFocus(
  controller: FocusSessionController,
  monitor: IdleMonitor,
  tracker: FocusTracker,
  timeline?: FocusTimeline,
) {
  const stopMonitor = monitor.subscribe((event) => {
    if (event.type !== "status") return
    tracker.mark(event.status)
    const snapshot = controller.snapshot()
    if (snapshot.phase === "work") timeline?.mark(event.status, workElapsedMs(snapshot))
  })
  const stopController = controller.subscribe((event, snapshot) => {
    // The finished round stays visible during the break; ending the session clears it.
    if (event.type === "work-complete") return timeline?.mark("neutral", workElapsedMs(snapshot))
    if (event.type === "ended") return timeline?.reset()
    if (event.type !== "phase" || event.phase !== "work") return
    timeline?.reset()
    timeline?.mark(monitor.status(), 0)
    if (snapshot.round !== 1) return
    tracker.reset()
    tracker.mark(monitor.status())
  })
  return () => {
    stopMonitor()
    stopController()
  }
}

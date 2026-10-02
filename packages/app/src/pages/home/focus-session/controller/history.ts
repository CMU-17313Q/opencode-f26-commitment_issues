import type { IdleMonitor } from "./idle-monitor"
import type { Clock } from "./ports"
import type { FocusSessionController } from "./session-controller"

export type FocusOutcome = "finished" | "ended" | "cancelled"

export type FocusHistoryRecord = {
  startedAt: number
  endedAt: number
  workMinutes: number
  breakMinutes: number
  roundsCompleted: number
  helpRequests: number
  outcome: FocusOutcome
  trackID?: string
}

export const HISTORY_LIMIT = 50

// Newest first, capped so persisted storage stays small.
export function appendHistory(history: readonly FocusHistoryRecord[], record: FocusHistoryRecord) {
  return [record, ...history].slice(0, HISTORY_LIMIT)
}

export function summarizeHistory(history: readonly FocusHistoryRecord[]) {
  return {
    sessions: history.length,
    roundsCompleted: history.reduce((sum, item) => sum + item.roundsCompleted, 0),
    focusMinutes: history.reduce((sum, item) => sum + item.roundsCompleted * item.workMinutes, 0),
    helpRequests: history.reduce((sum, item) => sum + item.helpRequests, 0),
  }
}

// Builds one history record per session from controller and idle-monitor events.
export function trackHistory(input: {
  clock: Clock
  controller: FocusSessionController
  monitor: IdleMonitor
  save: (record: FocusHistoryRecord) => void
}) {
  const current = { startedAt: 0, rounds: 0, help: 0, active: false }

  const save = (outcome: FocusOutcome) => {
    const snapshot = input.controller.snapshot()
    input.save({
      startedAt: current.startedAt,
      endedAt: input.clock.now(),
      workMinutes: snapshot.timing?.workMinutes ?? 0,
      breakMinutes: snapshot.timing?.breakMinutes ?? 0,
      roundsCompleted: current.rounds,
      helpRequests: current.help,
      outcome,
      trackID: snapshot.trackID,
    })
    current.active = false
  }

  const stopController = input.controller.subscribe((event) => {
    if (event.type === "phase" && event.phase === "work" && !current.active) {
      Object.assign(current, { startedAt: input.clock.now(), rounds: 0, help: 0, active: true })
      return
    }
    if (event.type === "work-complete") current.rounds += 1
    if (event.type === "phase" && event.phase === "idle" && current.active) save("finished")
    if (event.type === "ended" && current.active) save(event.reason)
  })
  const stopMonitor = input.monitor.subscribe((event) => {
    if (event.type === "answered" && event.needsHelp && current.active) current.help += 1
  })
  return () => {
    stopController()
    stopMonitor()
  }
}

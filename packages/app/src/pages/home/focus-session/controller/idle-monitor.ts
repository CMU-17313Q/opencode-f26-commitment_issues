import type { Cancel, Clock } from "./ports"
import type { FocusSessionController } from "./session-controller"

// green = active, yellow = idle (check-in shown), red = unresponsive, grey = neutral
export type ActivityStatus = "active" | "idle" | "unresponsive" | "neutral"

export type IdleEvent =
  | { type: "status"; status: ActivityStatus }
  | { type: "check-in" }
  | { type: "answered"; needsHelp: boolean }

export const IDLE_AFTER_MS = 2 * 60_000
export const UNRESPONSIVE_AFTER_MS = 60_000

export function createIdleMonitor(deps: { clock: Clock }) {
  const listeners = new Set<(event: IdleEvent) => void>()
  const state = { status: "neutral" as ActivityStatus, cancel: undefined as Cancel | undefined }

  const emit = (event: IdleEvent) => {
    for (const listener of listeners) listener(event)
  }

  const setStatus = (status: ActivityStatus) => {
    if (state.status === status) return
    state.status = status
    emit({ type: "status", status })
  }

  const clear = () => {
    state.cancel?.()
    state.cancel = undefined
  }

  const watch = () => {
    clear()
    setStatus("active")
    state.cancel = deps.clock.after(IDLE_AFTER_MS, () => {
      setStatus("idle")
      emit({ type: "check-in" })
      state.cancel = deps.clock.after(UNRESPONSIVE_AFTER_MS, () => {
        state.cancel = undefined
        setStatus("unresponsive")
      })
    })
  }

  return {
    status: () => state.status,
    subscribe(listener: (event: IdleEvent) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    enable() {
      if (state.status !== "neutral") return
      watch()
    },
    disable() {
      clear()
      setStatus("neutral")
    },
    // Ordinary input only restarts the countdown while green. Once the check-in is showing,
    // only an explicit answer clears it, so reaching for the "No" button does not dismiss it.
    activity() {
      if (state.status !== "active") return
      watch()
    },
    answer(needsHelp: boolean) {
      if (state.status !== "idle" && state.status !== "unresponsive") return false
      emit({ type: "answered", needsHelp })
      watch()
      return true
    },
  }
}

export type IdleMonitor = ReturnType<typeof createIdleMonitor>

// Monitor activity only while the user is actually working: grey during breaks, pauses and idle.
export function followSession(controller: FocusSessionController, monitor: IdleMonitor) {
  const sync = () => {
    const snapshot = controller.snapshot()
    if (snapshot.phase === "work" && !snapshot.paused) return monitor.enable()
    monitor.disable()
  }
  sync()
  return controller.subscribe((event) => {
    if (event.type === "tick") return
    sync()
  })
}

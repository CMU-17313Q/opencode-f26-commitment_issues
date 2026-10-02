import type { AudioPort, Cancel, Clock } from "./ports"
import type { FocusTiming } from "./presets"

export type FocusPhase = "idle" | "work" | "break" | "break-ended"

export type FocusSnapshot = {
  phase: FocusPhase
  paused: boolean
  locked: boolean
  remainingMs: number
  round: number
  timing?: FocusTiming
  trackID?: string
}

export type FocusEvent =
  | { type: "phase"; phase: FocusPhase }
  | { type: "tick" }
  | { type: "paused" }
  | { type: "resumed" }
  | { type: "unlocked" }
  | { type: "work-complete"; round: number }
  | { type: "ended"; reason: "ended" | "cancelled"; phase: FocusPhase; round: number }

export type FocusStartInput = {
  timing: FocusTiming
  trackID?: string
  volume: number
}

export const TICK_MS = 250
export const FADE_OUT_MS = 5_000
export const END_FADE_MS = 300
export const DUCK_LEVEL = 0.25

const MINUTE = 60_000

// One controller drives both the timer and the music so they cannot drift apart: every
// phase change and every pause/resume/end calls the audio port in the same step.
export function createFocusSessionController(deps: { clock: Clock; audio: AudioPort }) {
  const listeners = new Set<(event: FocusEvent, snapshot: FocusSnapshot) => void>()
  const state = {
    phase: "idle" as FocusPhase,
    paused: false,
    round: 0,
    deadline: 0,
    remainingMs: 0,
    volume: 1,
    fading: false,
    ducked: false,
    unlocked: false,
    timing: undefined as FocusTiming | undefined,
    trackID: undefined as string | undefined,
    stopTicker: undefined as Cancel | undefined,
    stopDuck: undefined as Cancel | undefined,
  }

  const snapshot = (): FocusSnapshot => ({
    phase: state.phase,
    paused: state.paused,
    locked: state.phase === "work" && !state.unlocked,
    remainingMs: remaining(),
    round: state.round,
    timing: state.timing,
    trackID: state.trackID,
  })

  const remaining = () => {
    if (state.phase !== "work" && state.phase !== "break") return 0
    if (state.paused) return state.remainingMs
    return Math.max(0, state.deadline - deps.clock.now())
  }

  const emit = (event: FocusEvent) => {
    const current = snapshot()
    for (const listener of listeners) listener(event, current)
  }

  const musicPlaying = () => state.phase === "work" && !state.paused && !!state.trackID

  const startTicker = () => {
    state.stopTicker?.()
    state.stopTicker = deps.clock.every(TICK_MS, tick)
  }

  const clearTimers = () => {
    state.stopTicker?.()
    state.stopTicker = undefined
    state.stopDuck?.()
    state.stopDuck = undefined
    state.ducked = false
  }

  const enterPhase = (phase: FocusPhase, minutes = 0) => {
    state.phase = phase
    state.paused = false
    state.fading = false
    state.unlocked = false
    state.deadline = deps.clock.now() + minutes * MINUTE
    if (phase === "work" || phase === "break") startTicker()
    emit({ type: "phase", phase })
  }

  const beginWork = () => {
    if (!state.timing) return
    state.round += 1
    // Start the music in the same synchronous step as the timer (also satisfies autoplay rules).
    if (state.trackID) deps.audio.play(state.trackID, { volume: state.volume, loop: true })
    enterPhase("work", state.timing.workMinutes)
  }

  const completeWork = () => {
    clearTimers()
    // Music must be fully stopped before the celebration appears.
    if (state.trackID) deps.audio.stop(0)
    emit({ type: "work-complete", round: state.round })
    if (!state.timing || state.timing.breakMinutes === 0) {
      enterPhase("break-ended")
      return
    }
    enterPhase("break", state.timing.breakMinutes)
  }

  const tick = () => {
    if (state.paused) return
    const left = remaining()
    if (state.phase === "work" && left <= 0) return completeWork()
    if (state.phase === "break" && left <= 0) {
      clearTimers()
      enterPhase("break-ended")
      return
    }
    if (state.phase === "work" && left <= FADE_OUT_MS && !state.fading && state.trackID) {
      state.fading = true
      deps.audio.fadeOut(left)
    }
    emit({ type: "tick" })
  }

  return {
    snapshot,
    subscribe(listener: (event: FocusEvent, snapshot: FocusSnapshot) => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start(input: FocusStartInput) {
      if (state.phase !== "idle") return false
      state.timing = { ...input.timing }
      state.trackID = input.trackID
      state.volume = input.volume
      state.round = 0
      beginWork()
      return true
    },
    nextRound() {
      if (state.phase !== "break-ended") return false
      beginWork()
      return true
    },
    finish() {
      if (state.phase !== "break-ended") return false
      state.phase = "idle"
      state.round = 0
      emit({ type: "phase", phase: "idle" })
      return true
    },
    pause() {
      if ((state.phase !== "work" && state.phase !== "break") || state.paused) return false
      state.remainingMs = remaining()
      state.paused = true
      state.fading = false
      const wasDucked = state.ducked
      clearTimers()
      if (state.phase === "work" && state.trackID) deps.audio.pause()
      if (wasDucked) deps.audio.setVolume(state.volume)
      emit({ type: "paused" })
      return true
    },
    resume() {
      if (!state.paused) return false
      state.paused = false
      state.deadline = deps.clock.now() + state.remainingMs
      if (state.phase === "work" && state.trackID) deps.audio.resume()
      startTicker()
      emit({ type: "resumed" })
      return true
    },
    end(reason: "ended" | "cancelled" = "ended") {
      if (state.phase === "idle") return false
      const phase = state.phase
      clearTimers()
      if (phase === "work" && state.trackID) deps.audio.stop(END_FADE_MS)
      state.phase = "idle"
      state.paused = false
      emit({ type: "ended", reason, phase, round: state.round })
      state.round = 0
      return true
    },
    // Lift the UI lock for the rest of this work period (e.g. to read the agent's help answer).
    // The timer and music keep running; the next work round locks again.
    releaseLock() {
      if (state.phase !== "work" || state.unlocked) return false
      state.unlocked = true
      emit({ type: "unlocked" })
      return true
    },
    setVolume(volume: number) {
      state.volume = volume
      if (state.trackID && !state.ducked) deps.audio.setVolume(volume)
    },
    // Briefly lower the music while the companion speaks, then restore the current volume.
    duck(ms: number) {
      if (!musicPlaying() || state.fading) return false
      state.stopDuck?.()
      state.ducked = true
      deps.audio.setVolume(state.volume * DUCK_LEVEL)
      state.stopDuck = deps.clock.after(ms, () => {
        state.stopDuck = undefined
        state.ducked = false
        if (musicPlaying() && !state.fading) deps.audio.setVolume(state.volume)
      })
      return true
    },
  }
}

export type FocusSessionController = ReturnType<typeof createFocusSessionController>

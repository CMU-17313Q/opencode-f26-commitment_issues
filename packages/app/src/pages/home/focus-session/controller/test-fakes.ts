import type { AudioPort, Clock } from "./ports"

// Deterministic clock for tests: time only moves when advance() is called.
export function createFakeClock(start = 0) {
  const timers = new Map<number, { at: number; every?: number; fn: () => void }>()
  const state = { now: start, nextID: 0 }

  const schedule = (at: number, fn: () => void, every?: number) => {
    const id = state.nextID++
    timers.set(id, { at, every, fn })
    return () => {
      timers.delete(id)
    }
  }

  const clock: Clock = {
    now: () => state.now,
    every: (ms, fn) => schedule(state.now + ms, fn, ms),
    after: (ms, fn) => schedule(state.now + ms, fn),
  }

  return {
    clock,
    pending: () => timers.size,
    advance(ms: number) {
      const target = state.now + ms
      while (true) {
        const due = [...timers.entries()]
          .filter((entry) => entry[1].at <= target)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]
        if (!due) break
        state.now = due[1].at
        if (due[1].every) due[1].at += due[1].every
        if (!due[1].every) timers.delete(due[0])
        due[1].fn()
      }
      state.now = target
    },
  }
}

// Records every call instead of playing sound. Shares a log with the test so ordering can be checked.
export function createFakeAudio(log: string[] = []) {
  const audio: AudioPort = {
    play: (trackID, options) => log.push(`play:${trackID}:${options.volume}:${options.loop ? "loop" : "once"}`),
    pause: () => log.push("pause"),
    resume: () => log.push("resume"),
    setVolume: (volume) => log.push(`volume:${volume}`),
    fadeOut: (ms) => log.push(`fadeOut:${ms}`),
    stop: (fadeMs) => log.push(`stop:${fadeMs}`),
  }
  return { audio, log }
}

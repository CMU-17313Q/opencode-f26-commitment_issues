// Dependencies the session controller needs from the outside world. Injected so tests can
// use a fake clock and a fake audio player and never play real sound.

export type Cancel = () => void

export type Clock = {
  now(): number
  every(ms: number, fn: () => void): Cancel
  after(ms: number, fn: () => void): Cancel
}

export type AudioPort = {
  play(trackID: string, options: { volume: number; loop: boolean }): void
  pause(): void
  resume(): void
  setVolume(volume: number): void
  fadeOut(ms: number): void
  stop(fadeMs: number): void
}

export const systemClock: Clock = {
  now: () => Date.now(),
  every(ms, fn) {
    const handle = setInterval(fn, ms)
    return () => clearInterval(handle)
  },
  after(ms, fn) {
    const handle = setTimeout(fn, ms)
    return () => clearTimeout(handle)
  },
}

export const silentAudio: AudioPort = {
  play() {},
  pause() {},
  resume() {},
  setVolume() {},
  fadeOut() {},
  stop() {},
}

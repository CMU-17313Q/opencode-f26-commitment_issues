import { describe, expect, test } from "bun:test"
import { DUCK_LEVEL, END_FADE_MS, FADE_OUT_MS, createFocusSessionController } from "./session-controller"
import { createFakeAudio, createFakeClock } from "./test-fakes"

const MINUTE = 60_000

// Pass null for "No music" (undefined would fall back to the default track).
function setup(timing = { workMinutes: 25, breakMinutes: 5 }, track: string | null = "lofi-1") {
  const trackID = track ?? undefined
  const time = createFakeClock()
  const fake = createFakeAudio()
  const controller = createFocusSessionController({ clock: time.clock, audio: fake.audio })
  controller.subscribe((event) => {
    if (event.type === "phase") fake.log.push(`event:phase:${event.phase}`)
    if (event.type !== "tick" && event.type !== "phase") fake.log.push(`event:${event.type}`)
  })
  const start = () => controller.start({ timing, trackID, volume: 0.8 })
  return { time, log: fake.log, controller, start }
}

describe("work phase", () => {
  test("start begins the work countdown and locks the UI", () => {
    const s = setup()
    expect(s.start()).toBe(true)
    expect(s.controller.snapshot()).toMatchObject({ phase: "work", locked: true, remainingMs: 25 * MINUTE, round: 1 })
    s.time.advance(MINUTE)
    expect(s.controller.snapshot().remainingMs).toBe(24 * MINUTE)
  })

  test("starting twice is ignored", () => {
    const s = setup()
    s.start()
    expect(s.start()).toBe(false)
  })
})

describe("work then break transitions", () => {
  test("work ends, then the break starts automatically and the UI unlocks", () => {
    const s = setup()
    s.start()
    s.time.advance(25 * MINUTE)
    expect(s.controller.snapshot()).toMatchObject({ phase: "break", locked: false, remainingMs: 5 * MINUTE })
    expect(s.log).toContain("event:work-complete")
  })

  test("break end offers another round or done", () => {
    const s = setup()
    s.start()
    s.time.advance(30 * MINUTE)
    expect(s.controller.snapshot().phase).toBe("break-ended")
    expect(s.time.pending()).toBe(0)

    expect(s.controller.nextRound()).toBe(true)
    expect(s.controller.snapshot()).toMatchObject({ phase: "work", round: 2, remainingMs: 25 * MINUTE })
  })

  test("done returns to idle", () => {
    const s = setup()
    s.start()
    s.time.advance(30 * MINUTE)
    expect(s.controller.finish()).toBe(true)
    expect(s.controller.snapshot()).toMatchObject({ phase: "idle", locked: false, round: 0 })
  })

  test("a 0 minute break is skipped", () => {
    const s = setup({ workMinutes: 1, breakMinutes: 0 })
    s.start()
    s.time.advance(MINUTE)
    expect(s.controller.snapshot().phase).toBe("break-ended")
    expect(s.log).toContain("event:phase:break-ended")
    expect(s.log).not.toContain("event:phase:break")
  })

  test("next round and done are only allowed after the break", () => {
    const s = setup()
    s.start()
    expect(s.controller.nextRound()).toBe(false)
    expect(s.controller.finish()).toBe(false)
  })
})

describe("pause and resume", () => {
  test("pausing freezes the countdown and resuming continues it", () => {
    const s = setup()
    s.start()
    s.time.advance(MINUTE)
    s.controller.pause()
    s.time.advance(10 * MINUTE)
    expect(s.controller.snapshot()).toMatchObject({ paused: true, locked: true, remainingMs: 24 * MINUTE })
    s.controller.resume()
    s.time.advance(MINUTE)
    expect(s.controller.snapshot().remainingMs).toBe(23 * MINUTE)
  })

  test("the break can also be paused", () => {
    const s = setup()
    s.start()
    s.time.advance(26 * MINUTE)
    expect(s.controller.pause()).toBe(true)
    s.time.advance(10 * MINUTE)
    expect(s.controller.snapshot()).toMatchObject({ phase: "break", remainingMs: 4 * MINUTE })
  })
})

describe("end session", () => {
  test("ending clears every timer and returns to idle", () => {
    const s = setup()
    s.start()
    s.time.advance(MINUTE)
    expect(s.controller.end()).toBe(true)
    expect(s.time.pending()).toBe(0)
    expect(s.controller.snapshot()).toMatchObject({ phase: "idle", locked: false, remainingMs: 0 })
    s.time.advance(60 * MINUTE)
    expect(s.controller.snapshot().phase).toBe("idle")
  })

  test("the ended event reports the reason and the phase it interrupted", () => {
    const s = setup()
    const events: unknown[] = []
    s.controller.subscribe((event) => {
      if (event.type === "ended") events.push(event)
    })
    s.start()
    s.controller.end("cancelled")
    expect(events).toEqual([{ type: "ended", reason: "cancelled", phase: "work", round: 1 }])
  })

  test("ending when idle does nothing", () => {
    expect(setup().controller.end()).toBe(false)
  })
})

describe("music follows the timer", () => {
  test("the track starts looping in the same call that starts the timer", () => {
    const s = setup()
    s.start()
    expect(s.log.slice(0, 2)).toEqual(["play:lofi-1:0.8:loop", "event:phase:work"])
  })

  test("no music still runs the timer and never touches audio", () => {
    const s = setup({ workMinutes: 1, breakMinutes: 1 }, null)
    s.start()
    s.controller.pause()
    s.controller.resume()
    s.controller.duck(1000)
    s.time.advance(2 * MINUTE)
    expect(s.controller.snapshot().phase).toBe("break-ended")
    expect(s.log.filter((entry) => !entry.startsWith("event:"))).toEqual([])
  })

  test("pause and resume pause and resume the music", () => {
    const s = setup()
    s.start()
    s.controller.pause()
    s.controller.resume()
    expect(s.log.filter((entry) => entry === "pause" || entry === "resume")).toEqual(["pause", "resume"])
  })

  test("music fades out over the last 5 seconds, then stops before the celebration", () => {
    const s = setup()
    s.start()
    s.time.advance(25 * MINUTE - FADE_OUT_MS - 1000)
    expect(s.log.some((entry) => entry.startsWith("fadeOut"))).toBe(false)
    s.time.advance(1000)
    expect(s.log).toContain(`fadeOut:${FADE_OUT_MS}`)
    s.time.advance(FADE_OUT_MS)
    const stop = s.log.indexOf("stop:0")
    expect(stop).toBeGreaterThan(-1)
    expect(stop).toBeLessThan(s.log.indexOf("event:work-complete"))
    expect(s.log.filter((entry) => entry.startsWith("fadeOut"))).toHaveLength(1)
  })

  test("no music plays during the break", () => {
    const s = setup()
    s.start()
    s.time.advance(25 * MINUTE)
    const afterWork = s.log.length
    s.controller.pause()
    s.controller.resume()
    s.time.advance(5 * MINUTE)
    expect(s.log.slice(afterWork).filter((entry) => !entry.startsWith("event:"))).toEqual([])
  })

  test("the next round restarts the music", () => {
    const s = setup()
    s.start()
    s.time.advance(30 * MINUTE)
    s.controller.nextRound()
    expect(s.log.filter((entry) => entry.startsWith("play"))).toHaveLength(2)
  })

  test("ending or cancelling stops the music with a short fade", () => {
    for (const reason of ["ended", "cancelled"] as const) {
      const s = setup()
      s.start()
      s.controller.end(reason)
      expect(s.log).toContain(`stop:${END_FADE_MS}`)
    }
  })

  test("ending during the break does not touch the stopped music", () => {
    const s = setup()
    s.start()
    s.time.advance(26 * MINUTE)
    s.controller.end()
    expect(s.log.filter((entry) => entry.startsWith("stop"))).toEqual(["stop:0"])
  })

  test("duck lowers the volume, then restores it", () => {
    const s = setup()
    s.start()
    expect(s.controller.duck(1500)).toBe(true)
    expect(s.log.at(-1)).toBe(`volume:${0.8 * DUCK_LEVEL}`)
    s.time.advance(1500)
    expect(s.log.at(-1)).toBe("volume:0.8")
  })

  test("duck restores the latest volume if it changed meanwhile", () => {
    const s = setup()
    s.start()
    s.controller.duck(1500)
    s.controller.setVolume(0.5)
    s.time.advance(1500)
    expect(s.log.at(-1)).toBe("volume:0.5")
  })

  test("pausing while ducked restores the volume for when music resumes", () => {
    const s = setup()
    s.start()
    s.controller.duck(1500)
    s.controller.pause()
    const audioCalls = s.log.filter((entry) => !entry.startsWith("event:"))
    expect(audioCalls.slice(-2)).toEqual(["pause", "volume:0.8"])
  })

  test("duck is skipped while paused or fading out", () => {
    const s = setup()
    s.start()
    s.controller.pause()
    expect(s.controller.duck(1000)).toBe(false)
    s.controller.resume()
    s.time.advance(25 * MINUTE - 2000)
    expect(s.controller.duck(1000)).toBe(false)
  })
})

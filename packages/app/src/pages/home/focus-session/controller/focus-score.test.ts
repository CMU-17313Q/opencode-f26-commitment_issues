import { describe, expect, test } from "bun:test"
import { createFocusTracker, focusBand, followFocus } from "./focus-score"
import { createFocusTimeline } from "./focus-timeline"
import { IDLE_AFTER_MS, UNRESPONSIVE_AFTER_MS, createIdleMonitor, followSession } from "./idle-monitor"
import { createFocusSessionController } from "./session-controller"
import { createFakeAudio, createFakeClock } from "./test-fakes"

const MINUTE = 60_000

function setup() {
  const time = createFakeClock()
  const controller = createFocusSessionController({ clock: time.clock, audio: createFakeAudio().audio })
  const monitor = createIdleMonitor({ clock: time.clock })
  followSession(controller, monitor)
  const tracker = createFocusTracker({ clock: time.clock })
  followFocus(controller, monitor, tracker)
  const start = () => controller.start({ timing: { workMinutes: 25, breakMinutes: 5 }, volume: 1 })
  return { time, controller, monitor, tracker, start }
}

describe("timeline during a session", () => {
  test("colors the round green, yellow, red, green, yellow, red as the student's focus changes", () => {
    const time = createFakeClock()
    const controller = createFocusSessionController({ clock: time.clock, audio: createFakeAudio().audio })
    const monitor = createIdleMonitor({ clock: time.clock })
    followSession(controller, monitor)
    const timeline = createFocusTimeline()
    followFocus(controller, monitor, createFocusTracker({ clock: time.clock }), timeline)

    controller.start({ timing: { workMinutes: 10, breakMinutes: 5 }, volume: 1 })
    time.advance(IDLE_AFTER_MS) // green 0-2, then yellow
    time.advance(UNRESPONSIVE_AFTER_MS) // yellow 2-3, then red
    time.advance(MINUTE) // red 3-4
    monitor.answer(false) // green again 4-6
    time.advance(6 * MINUTE) // quiet again: yellow 6-7, red 7-10, round ends at 10

    expect(timeline.segments()).toEqual([
      { status: "active", from: 0, to: 2 * MINUTE },
      { status: "idle", from: 2 * MINUTE, to: 3 * MINUTE },
      { status: "unresponsive", from: 3 * MINUTE, to: 4 * MINUTE },
      { status: "active", from: 4 * MINUTE, to: 6 * MINUTE },
      { status: "idle", from: 6 * MINUTE, to: 7 * MINUTE },
      { status: "unresponsive", from: 7 * MINUTE, to: 10 * MINUTE },
    ])
    expect(controller.snapshot().phase).toBe("break")
  })

  test("each new round starts with a fresh green bar", () => {
    const time = createFakeClock()
    const controller = createFocusSessionController({ clock: time.clock, audio: createFakeAudio().audio })
    const monitor = createIdleMonitor({ clock: time.clock })
    followSession(controller, monitor)
    const timeline = createFocusTimeline()
    followFocus(controller, monitor, createFocusTracker({ clock: time.clock }), timeline)
    controller.start({ timing: { workMinutes: 5, breakMinutes: 1 }, volume: 1 })
    time.advance(6 * MINUTE)
    controller.nextRound()
    expect(timeline.segments()).toEqual([{ status: "active", from: 0 }])
    controller.end()
    expect(timeline.segments()).toEqual([])
  })
})

describe("focusBand", () => {
  test("maps scores to green (focused), yellow (distracted) and red (not focused)", () => {
    expect([100, 70, 69, 40, 39, 0].map(focusBand)).toEqual([
      "focused",
      "focused",
      "distracted",
      "distracted",
      "unfocused",
      "unfocused",
    ])
  })
})

describe("focus score", () => {
  test("starts at 100% (MAX) and stays there while the student is active", () => {
    const s = setup()
    expect(s.tracker.snapshot().score).toBe(100)
    s.start()
    s.time.advance(MINUTE)
    s.monitor.activity()
    s.time.advance(MINUTE)
    expect(s.tracker.snapshot()).toMatchObject({ score: 100, band: "focused", focusedMs: 2 * MINUTE })
  })

  test("drops while the check-in is showing and while unanswered", () => {
    const s = setup()
    s.start()
    s.time.advance(IDLE_AFTER_MS) // 2 min focused, then yellow
    s.time.advance(UNRESPONSIVE_AFTER_MS) // 1 min yellow, then red
    s.time.advance(MINUTE) // 1 min red
    expect(s.tracker.snapshot()).toMatchObject({ focusedMs: 2 * MINUTE, trackedMs: 4 * MINUTE, score: 50 })
    expect(s.tracker.snapshot().band).toBe("distracted")
    s.time.advance(4 * MINUTE) // 2 of 8 minutes focused
    expect(s.tracker.snapshot()).toMatchObject({ score: 25, band: "unfocused" })
  })

  test("leaving opencode counts as time away and lowers the score", () => {
    const s = setup()
    s.start()
    s.time.advance(MINUTE + 30_000)
    s.monitor.activity()
    s.time.advance(MINUTE + 30_000) // 3 min focused
    s.monitor.away()
    s.tracker.setAway(true)
    s.time.advance(MINUTE)
    s.tracker.setAway(false)
    s.monitor.answer(false)
    expect(s.tracker.snapshot()).toMatchObject({ awayMs: MINUTE, score: 75, band: "focused" })
  })

  test("paused time and breaks do not count", () => {
    const s = setup()
    s.start()
    s.time.advance(MINUTE)
    s.controller.pause()
    s.time.advance(10 * MINUTE)
    s.controller.resume()
    s.time.advance(24 * MINUTE)
    s.time.advance(5 * MINUTE) // break
    expect(s.tracker.snapshot()).toMatchObject({ trackedMs: 25 * MINUTE })
  })

  test("away time is only counted while tracking", () => {
    const s = setup()
    s.tracker.setAway(true)
    s.time.advance(MINUTE)
    expect(s.tracker.snapshot().awayMs).toBe(0)
  })

  test("keeps the score across rounds and resets for a new session", () => {
    const s = setup()
    s.start()
    s.time.advance(IDLE_AFTER_MS)
    s.monitor.answer(false) // 2 min focused, 0 idle (answered right away)
    s.time.advance(30 * MINUTE - IDLE_AFTER_MS)
    s.controller.nextRound()
    expect(s.tracker.snapshot().trackedMs).toBe(25 * MINUTE)
    s.controller.end()
    s.start()
    expect(s.tracker.snapshot()).toMatchObject({ score: 100, trackedMs: 0, awayMs: 0 })
  })
})

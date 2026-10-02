import { describe, expect, test } from "bun:test"
import { HISTORY_LIMIT, appendHistory, summarizeHistory, trackHistory, type FocusHistoryRecord } from "./history"
import { IDLE_AFTER_MS, createIdleMonitor, followSession } from "./idle-monitor"
import { createFocusSessionController } from "./session-controller"
import { createFakeAudio, createFakeClock } from "./test-fakes"

const MINUTE = 60_000

function record(overrides: Partial<FocusHistoryRecord> = {}): FocusHistoryRecord {
  return {
    startedAt: 0,
    endedAt: 0,
    workMinutes: 25,
    breakMinutes: 5,
    roundsCompleted: 1,
    helpRequests: 0,
    outcome: "finished",
    ...overrides,
  }
}

function setup() {
  const time = createFakeClock(1_000)
  const controller = createFocusSessionController({ clock: time.clock, audio: createFakeAudio().audio })
  const monitor = createIdleMonitor({ clock: time.clock })
  followSession(controller, monitor)
  const saved: FocusHistoryRecord[] = []
  trackHistory({ clock: time.clock, controller, monitor, save: (item) => saved.push(item) })
  const start = () => controller.start({ timing: { workMinutes: 25, breakMinutes: 5 }, trackID: "lofi-1", volume: 1 })
  return { time, controller, monitor, saved, start }
}

describe("history storage helpers", () => {
  test("appends newest first and caps the list", () => {
    const full = Array.from({ length: HISTORY_LIMIT }, (_, i) => record({ startedAt: i }))
    const next = appendHistory(full, record({ startedAt: 999 }))
    expect(next).toHaveLength(HISTORY_LIMIT)
    expect(next[0].startedAt).toBe(999)
    expect(full).toHaveLength(HISTORY_LIMIT)
  })

  test("summarizes total focus time and help requests", () => {
    expect(
      summarizeHistory([
        record({ roundsCompleted: 2, workMinutes: 25, helpRequests: 1 }),
        record({ roundsCompleted: 0, workMinutes: 50, outcome: "ended" }),
      ]),
    ).toEqual({ sessions: 2, roundsCompleted: 2, focusMinutes: 50, helpRequests: 1 })
  })
})

describe("trackHistory", () => {
  test("records a finished session with its rounds", () => {
    const s = setup()
    s.start()
    s.time.advance(30 * MINUTE)
    s.controller.nextRound()
    s.time.advance(30 * MINUTE)
    s.controller.finish()
    expect(s.saved).toEqual([
      {
        startedAt: 1_000,
        endedAt: 1_000 + 60 * MINUTE,
        workMinutes: 25,
        breakMinutes: 5,
        roundsCompleted: 2,
        helpRequests: 0,
        outcome: "finished",
        trackID: "lofi-1",
      },
    ])
  })

  test("records a session ended early and counts help requests", () => {
    const s = setup()
    s.start()
    s.time.advance(IDLE_AFTER_MS)
    s.monitor.answer(true)
    s.time.advance(IDLE_AFTER_MS)
    s.monitor.answer(false)
    s.controller.end()
    expect(s.saved).toHaveLength(1)
    expect(s.saved[0]).toMatchObject({ outcome: "ended", roundsCompleted: 0, helpRequests: 1 })
  })

  test("records cancelled sessions and starts fresh for the next one", () => {
    const s = setup()
    s.start()
    s.controller.end("cancelled")
    s.start()
    s.time.advance(25 * MINUTE)
    s.controller.end()
    expect(s.saved.map((item) => [item.outcome, item.roundsCompleted])).toEqual([
      ["cancelled", 0],
      ["ended", 1],
    ])
  })
})

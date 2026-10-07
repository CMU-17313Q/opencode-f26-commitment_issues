import { describe, expect, test } from "bun:test"
import { createFocusTimeline, layoutTimeline } from "./focus-timeline"

const MINUTE = 60_000

describe("focus timeline", () => {
  test("records green, yellow, red, green stretches in order", () => {
    const timeline = createFocusTimeline()
    timeline.mark("active", 0)
    timeline.mark("idle", 2 * MINUTE)
    timeline.mark("unresponsive", 3 * MINUTE)
    timeline.mark("active", 4 * MINUTE)
    expect(timeline.segments()).toEqual([
      { status: "active", from: 0, to: 2 * MINUTE },
      { status: "idle", from: 2 * MINUTE, to: 3 * MINUTE },
      { status: "unresponsive", from: 3 * MINUTE, to: 4 * MINUTE },
      { status: "active", from: 4 * MINUTE },
    ])
  })

  test("repeating the same status does not split the stretch", () => {
    const timeline = createFocusTimeline()
    timeline.mark("active", 0)
    timeline.mark("active", MINUTE)
    expect(timeline.segments()).toEqual([{ status: "active", from: 0 }])
  })

  test("not tracking (paused) closes the stretch; resuming starts a new one", () => {
    const timeline = createFocusTimeline()
    timeline.mark("active", 0)
    timeline.mark("neutral", MINUTE)
    timeline.mark("active", MINUTE)
    expect(timeline.segments()).toEqual([
      { status: "active", from: 0, to: MINUTE },
      { status: "active", from: MINUTE },
    ])
  })

  test("reset clears the round", () => {
    const timeline = createFocusTimeline()
    timeline.mark("idle", 0)
    timeline.reset()
    expect(timeline.segments()).toEqual([])
  })
})

describe("layoutTimeline", () => {
  test("places each stretch as a percentage of the round, open stretch up to now", () => {
    const view = layoutTimeline(
      [
        { status: "active", from: 0, to: 5 * MINUTE },
        { status: "idle", from: 5 * MINUTE, to: 6 * MINUTE },
        { status: "active", from: 6 * MINUTE },
      ],
      8 * MINUTE,
      10 * MINUTE,
    )
    expect(view.segments).toEqual([
      { status: "active", left: 0, width: 50 },
      { status: "idle", left: 50, width: 10 },
      { status: "active", left: 60, width: 20 },
    ])
  })

  test("never draws past the end of the round and skips empty stretches", () => {
    const view = layoutTimeline(
      [
        { status: "active", from: 0, to: 0 },
        { status: "unresponsive", from: 0 },
      ],
      12 * MINUTE,
      10 * MINUTE,
    )
    expect(view.segments).toEqual([{ status: "unresponsive", left: 0, width: 100 }])
  })
})

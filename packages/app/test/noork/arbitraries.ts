// fast-check generators (arbitraries) for the Focus Session property tests.
//
// Plain random numbers almost never land exactly on the thresholds users cared about in
// the P4A interviews (2 minutes idle -> yellow, 60 more seconds -> red, the 25/5 and 50/10
// presets, pausing right before the round ends). So every generator below mixes:
//   1. hand-picked boundary values (threshold - 1 ms, threshold, threshold + 1 ms, 0), and
//   2. a uniform range around them,
// which lets fast-check hit both the edges and the ordinary cases, and shrink a failure
// down to a readable counterexample.
import fc from "fast-check"
import { BREAK_LIMITS, FOCUS_PRESETS, WORK_LIMITS } from "../../src/pages/home/focus-session/controller/presets"
import { TICK_MS } from "../../src/pages/home/focus-session/controller/session-controller"
import type { TimelineSegment, TimelineStatus } from "../../src/pages/home/focus-session/controller/focus-timeline"
import { REQ_IDLE_MS, REQ_RED_AFTER_MS, type SessionAction } from "./harness"

// Durations that sit exactly on, or 1 ms either side of, the idle (2:00) and red (+1:00)
// thresholds, plus the controller's 250 ms tick. These are where off-by-one bugs live.
const BOUNDARY_MS = [
  0,
  1,
  TICK_MS,
  REQ_IDLE_MS - 1,
  REQ_IDLE_MS,
  REQ_IDLE_MS + 1,
  REQ_RED_AFTER_MS - 1,
  REQ_RED_AFTER_MS,
  REQ_RED_AFTER_MS + 1,
  REQ_IDLE_MS + REQ_RED_AFTER_MS,
]

// How long the user goes without input. Up to 4 minutes covers green -> yellow -> red and
// back, while keeping the fake-clock runs fast.
export const delayArb = fc.oneof(
  { weight: 1, arbitrary: fc.constantFrom(...BOUNDARY_MS) },
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 4 * 60_000 }) },
)

// A work/break timing a user can actually pick on the card: one of the two presets
// (25/5 and 50/10, the ones interviewees used), or any valid custom timing including the
// extremes (1-minute work, 0-minute break, 120-minute work).
export const timingArb = fc.oneof(
  fc.constantFrom(...FOCUS_PRESETS.map((preset) => ({ ...preset.timing }))),
  fc.record({
    workMinutes: fc.oneof(
      fc.constantFrom(WORK_LIMITS.min, WORK_LIMITS.max),
      fc.integer({ min: WORK_LIMITS.min, max: WORK_LIMITS.max }),
    ),
    breakMinutes: fc.oneof(
      fc.constantFrom(BREAK_LIMITS.min, BREAK_LIMITS.max),
      fc.integer({ min: BREAK_LIMITS.min, max: BREAK_LIMITS.max }),
    ),
  }),
)

// Timings long enough that a whole generated action sequence fits inside one work round
// (5+ minutes), so the round-scoped properties are not cut short by the break starting.
export const longTimingArb = fc.record({
  workMinutes: fc.integer({ min: 30, max: WORK_LIMITS.max }),
  breakMinutes: fc.integer({ min: BREAK_LIMITS.min, max: BREAK_LIMITS.max }),
})

// Everything a user can do to the idle monitor during a work round: let time pass, touch
// the keyboard/mouse, leave the tab, or answer the check-in either way. "advance" is
// weighted up so sequences actually cross the 2:00 and 3:00 thresholds.
export const monitorActionArb: fc.Arbitrary<SessionAction> = fc.oneof(
  { weight: 4, arbitrary: delayArb.map((ms) => ({ type: "advance" as const, ms })) },
  { weight: 2, arbitrary: fc.constant({ type: "activity" as const }) },
  { weight: 1, arbitrary: fc.constant({ type: "away" as const }) },
  { weight: 2, arbitrary: fc.boolean().map((needsHelp) => ({ type: "answer" as const, needsHelp })) },
)

// Same as above plus pause / resume, for the whole-session properties (R2, R5).
export const sessionActionArb: fc.Arbitrary<SessionAction> = fc.oneof(
  { weight: 6, arbitrary: monitorActionArb },
  { weight: 1, arbitrary: fc.constant({ type: "pause" as const }) },
  { weight: 1, arbitrary: fc.constant({ type: "resume" as const }) },
)

// 1 to 20 actions: long enough to visit every status several times, short enough that
// a shrunk counterexample is easy to read.
export const sessionActionsArb = fc.array(sessionActionArb, { minLength: 1, maxLength: 20 })
export const monitorActionsArb = fc.array(monitorActionArb, { minLength: 1, maxLength: 30 })

const statusArb = fc.constantFrom<TimelineStatus>("active", "idle", "unresponsive")

// A recorded progress-bar timeline, built the way createFocusTimeline records one:
// back-to-back stretches starting at 0 with no gaps, the last one possibly still open.
// Durations include 1 ms slivers and the total may equal the recorded time exactly (a full
// bar) or exceed it (a bar still filling up).
export const timelineArb = fc
  .record({
    stretches: fc.array(
      fc.record({
        status: statusArb,
        ms: fc.oneof(fc.constant(1), fc.integer({ min: 1, max: 10 * 60_000 })),
      }),
      { minLength: 1, maxLength: 12 },
    ),
    lastOpen: fc.boolean(),
    extraTotalMs: fc.oneof(fc.constant(0), fc.integer({ min: 0, max: 30 * 60_000 })),
  })
  .map(({ stretches, lastOpen, extraTotalMs }) => {
    const segments: TimelineSegment[] = []
    let at = 0
    for (const stretch of stretches) {
      segments.push({ status: stretch.status, from: at, to: at + stretch.ms })
      at += stretch.ms
    }
    // An open (still running) last stretch is drawn up to "now" = elapsedMs.
    if (lastOpen) delete segments[segments.length - 1]!.to
    return { segments, elapsedMs: at, totalMs: at + extraTotalMs }
  })

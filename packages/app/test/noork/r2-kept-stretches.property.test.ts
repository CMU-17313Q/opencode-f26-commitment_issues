// Property-based tests for the Focus Session feature (Project 4B, noork): R2
//
// Each property names the requirement it checks (ID and wording, see traceability/noork.md)
// and its kind. Generators live in ./arbitraries.ts and are explained there; ./harness.ts
// wires the real controller, idle monitor, focus tracker and timeline together the same way
// session-store.ts does, on a fake clock.
import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import type { TimelineSegment } from "../../src/pages/home/focus-session/controller/focus-timeline"
import { delayArb, longTimingArb, sessionActionsArb, timingArb } from "./arbitraries"
import { MINUTE, REQ_IDLE_MS, REQ_RED_AFTER_MS, createSession } from "./harness"

// ---------------------------------------------------------------------------------------
// R2: A yellow or red stretch already recorded on the progress bar stays on the bar after
// the user answers the check-in.
// ---------------------------------------------------------------------------------------
describe("R2: recorded yellow/red stretches stay on the bar after answering", () => {
  // R2: A yellow or red stretch already recorded on the progress bar stays on the bar after
  // the user answers the check-in.
  // Kind: round-trip. Go away (green -> yellow, maybe red) and come back by answering
  // (-> green). The status returns to where it started, but the recorded history must not:
  // the bar is exactly green [0,a], yellow [a, a+b] (split into yellow then red if b >= 60 s),
  // then green from a+b. This generalizes the P4A acceptance example (a = 1:00, b = 0:30).
  test("R2 (round-trip): away then answer returns to green but keeps the yellow/red stretch", () => {
    fc.assert(
      fc.property(
        longTimingArb,
        fc.integer({ min: 0, max: REQ_IDLE_MS - 1 }),
        delayArb,
        fc.boolean(),
        (timing, a, b, needsHelp) => {
          const s = createSession()
          s.start(timing)
          s.apply({ type: "advance", ms: a })
          s.apply({ type: "away" })
          s.apply({ type: "advance", ms: b })
          s.apply({ type: "answer", needsHelp })

          // Back to green after answering...
          expect(s.monitor.status()).toBe("active")
          // ...but the away stretch is still recorded.
          const away: TimelineSegment[] =
            b < REQ_RED_AFTER_MS
              ? [{ status: "idle", from: a, to: a + b }]
              : [
                  { status: "idle", from: a, to: a + REQ_RED_AFTER_MS },
                  { status: "unresponsive", from: a + REQ_RED_AFTER_MS, to: a + b },
                ]
          expect(s.timeline.segments()).toEqual([
            { status: "active", from: 0, to: a },
            ...away,
            { status: "active", from: a + b },
          ])
          // The focus score must not count the away time as focused either (O-9: "I might
          // think I did more than I actually did").
          const focus = s.tracker.snapshot()
          expect(focus.trackedMs - focus.focusedMs).toBe(b)
        },
      ),
    )
  })

  // R2: A yellow or red stretch already recorded on the progress bar stays on the bar after
  // the user answers the check-in.
  // Kind: invariant. During a round the timeline is append-only: after ANY action (answer,
  // activity, pause, resume, time passing, the round ending) every stretch recorded before
  // is still there unchanged; the only allowed edit is closing the stretch that was open.
  test("R2 (invariant): the round's timeline is append-only — answering never removes or recolors a stretch", () => {
    fc.assert(
      fc.property(timingArb, sessionActionsArb, (timing, actions) => {
        const s = createSession()
        s.start(timing)
        let before = s.timeline.segments()
        for (const action of actions) {
          s.apply(action)
          const after = s.timeline.segments()
          expect(after.length).toBeGreaterThanOrEqual(before.length)
          before.forEach((old, i) => {
            expect(after[i]?.status).toBe(old.status)
            expect(after[i]?.from).toBe(old.from)
            if (old.to !== undefined) expect(after[i]?.to).toBe(old.to)
          })
          before = after
        }
      }),
    )
  })

  // R2 (supporting): the recorded stretches form one gap-free bar, so a kept yellow/red
  // stretch is drawn exactly where the user was away.
  // Kind: invariant. Stretches are back-to-back from 0, each has from <= to, only the last
  // may still be open, and nothing goes past the end of the round.
  test("R2 (invariant): recorded stretches are contiguous, ordered and inside the round", () => {
    fc.assert(
      fc.property(timingArb, sessionActionsArb, (timing, actions) => {
        const s = createSession()
        s.start(timing)
        actions.forEach(s.apply)
        const segments = s.timeline.segments()
        const roundMs = timing.workMinutes * MINUTE

        expect(segments[0]?.from).toBe(0)
        segments.forEach((segment, i) => {
          const last = i === segments.length - 1
          if (!last) {
            expect(segment.to).toBeDefined()
            expect(segments[i + 1]?.from).toBe(segment.to!)
          }
          if (segment.to !== undefined) expect(segment.to).toBeGreaterThanOrEqual(segment.from)
          expect(segment.to ?? segment.from).toBeLessThanOrEqual(roundMs)
        })
      }),
    )
  })
})

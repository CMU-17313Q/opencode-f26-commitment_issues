// Property-based tests for the Focus Session feature (Project 4B, noork): R5
//
// Each property names the requirement it checks (ID and wording, see traceability/noork.md)
// and its kind. Generators live in ./arbitraries.ts and are explained there; ./harness.ts
// wires the real controller, idle monitor, focus tracker and timeline together the same way
// session-store.ts does, on a fake clock.
import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { TICK_MS } from "../../src/pages/home/focus-session/controller/session-controller"
import { delayArb, longTimingArb, sessionActionsArb, timingArb } from "./arbitraries"
import { MINUTE, createSession } from "./harness"

// ---------------------------------------------------------------------------------------
// R5: While a session is paused, the timer does not advance and no new yellow or red
// stretch is recorded.
// ---------------------------------------------------------------------------------------
describe("R5: pausing freezes the timer and records nothing", () => {
  // R5: While a session is paused, the timer does not advance and no new yellow or red
  // stretch is recorded.
  // Kind: invariant. From any reachable point of a work round or a break, pause and let any
  // amount of time pass (including far past the 2:00 and 3:00 thresholds, and longer than
  // the round itself): the remaining time, the recorded stretches and the focus score are
  // all unchanged, the status is neutral (grey), and no check-in fires.
  test("R5 (invariant): while paused, time passing changes nothing and the status is grey", () => {
    fc.assert(
      fc.property(
        timingArb,
        sessionActionsArb,
        fc.boolean(),
        fc.oneof(delayArb, fc.integer({ min: 0, max: 3 * 60 * MINUTE })),
        (timing, actions, skipToBreak, pausedFor) => {
          const s = createSession()
          s.start(timing)
          actions.forEach(s.apply)
          s.controller.resume()
          // Sometimes run on into the break, so pausing a break is covered too.
          if (skipToBreak) s.apply({ type: "advance", ms: s.controller.snapshot().remainingMs + TICK_MS })
          const phase = s.controller.snapshot().phase
          fc.pre(phase === "work" || phase === "break")

          expect(s.controller.pause()).toBe(true)
          const frozen = {
            remainingMs: s.controller.snapshot().remainingMs,
            segments: s.timeline.segments(),
            focus: s.tracker.snapshot(),
            checkIns: s.checkIns.length,
          }

          s.apply({ type: "advance", ms: pausedFor })

          expect(s.controller.snapshot().phase).toBe(phase)
          expect(s.controller.snapshot().remainingMs).toBe(frozen.remainingMs)
          expect(s.monitor.status()).toBe("neutral")
          expect(s.timeline.segments()).toEqual(frozen.segments)
          expect(s.tracker.snapshot().trackedMs).toBe(frozen.focus.trackedMs)
          expect(s.tracker.snapshot().focusedMs).toBe(frozen.focus.focusedMs)
          expect(s.checkIns.length).toBe(frozen.checkIns)
        },
      ),
    )
  })

  // R5: While a session is paused, the timer does not advance and no new yellow or red
  // stretch is recorded.
  // Kind: round-trip. Pause then resume (with any wait in between) returns the session to
  // where it was: same remaining time, back to green, and the bar continues from the exact
  // point it stopped, with no gap and no yellow/red stretch for the paused time.
  test("R5 (round-trip): pause then resume restores the timer and the bar continues green from the same point", () => {
    fc.assert(
      fc.property(
        longTimingArb,
        sessionActionsArb,
        fc.oneof(delayArb, fc.integer({ min: 0, max: 3 * 60 * MINUTE })),
        (timing, actions, pausedFor) => {
          const s = createSession()
          s.start(timing)
          actions.forEach(s.apply)
          s.controller.resume()
          fc.pre(s.controller.snapshot().phase === "work")

          const remainingBefore = s.controller.snapshot().remainingMs
          const elapsedAtPause = s.elapsed()
          s.controller.pause()
          const segmentsWhilePaused = s.timeline.segments()
          s.apply({ type: "advance", ms: pausedFor })
          s.controller.resume()

          expect(s.controller.snapshot().remainingMs).toBe(remainingBefore)
          expect(s.monitor.status()).toBe("active")
          const after = s.timeline.segments()
          // Everything before the pause is unchanged, then exactly one new green stretch
          // that starts where the paused one ended.
          expect(after.slice(0, -1)).toEqual(segmentsWhilePaused)
          expect(after.at(-1)).toEqual({ status: "active", from: elapsedAtPause })
          expect(segmentsWhilePaused.at(-1)?.to).toBe(elapsedAtPause)
        },
      ),
    )
  })

  // R5: "While a session is paused, the timer does not advance ..."
  // Kind: model / oracle. Model of the countdown: remaining = round length - (time that
  // passed while NOT paused). For any mix of waits, pauses, resumes and user input during a
  // round, the controller's remaining time and paused flag match the model.
  test("R5 (model): remaining time equals round length minus unpaused time", () => {
    fc.assert(
      fc.property(longTimingArb, sessionActionsArb, (timing, actions) => {
        const s = createSession()
        s.start(timing)
        const workMs = timing.workMinutes * MINUTE
        const model = { paused: false, unpausedMs: 0 }

        for (const action of actions) {
          s.apply(action)
          if (action.type === "pause") model.paused = true
          if (action.type === "resume") model.paused = false
          if (action.type === "advance" && !model.paused) model.unpausedMs += action.ms
          // Stop comparing once the model says the round is over (the break takes over).
          if (model.unpausedMs >= workMs) break

          const snapshot = s.controller.snapshot()
          expect(snapshot.phase).toBe("work")
          expect(snapshot.paused).toBe(model.paused)
          expect(snapshot.remainingMs).toBe(workMs - model.unpausedMs)
        }
      }),
    )
  })
})

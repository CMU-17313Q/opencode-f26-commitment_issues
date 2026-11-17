// Property-based tests for the Focus Session feature (Project 4B, noork): R1
//
// Each property names the requirement it checks (ID and wording, see traceability/noork.md)
// and its kind. Generators live in ./arbitraries.ts and are explained there; ./harness.ts
// wires the real controller, idle monitor, focus tracker and timeline together the same way
// session-store.ts does, on a fake clock.
import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { type ActivityStatus, createIdleMonitor } from "../../src/pages/home/focus-session/controller/idle-monitor"
import { createFakeClock } from "../../src/pages/home/focus-session/controller/test-fakes"
import { longTimingArb, monitorActionsArb, sessionActionsArb, timingArb } from "./arbitraries"
import { REQ_IDLE_MS, REQ_RED_AFTER_MS, type SessionAction, createSession } from "./harness"

// ---------------------------------------------------------------------------------------
// R1: When the user leaves opencode or has no activity for 2 minutes during a work round,
// a "Need help?" check-in appears and the status turns yellow. If the check-in stays
// unanswered for 60 seconds, the status turns red.
// ---------------------------------------------------------------------------------------

// Reference model for R1, written directly from the requirement text. It is deliberately
// simple: it only remembers the current status and the absolute time of the next timed change.
type R1Model = { now: number; status: Exclude<ActivityStatus, "neutral">; next: number; checkIns: number }

function r1ModelStep(model: R1Model, action: SessionAction) {
  if (action.type === "advance") {
    const target = model.now + action.ms
    // Fire every timed change that is due by the target time, in order.
    while (model.next <= target) {
      model.now = model.next
      if (model.status === "active") {
        // 2 minutes without activity: yellow + check-in, red 60 s later if unanswered.
        model.status = "idle"
        model.checkIns += 1
        model.next = model.now + REQ_RED_AFTER_MS
      } else {
        model.status = "unresponsive"
        model.next = Infinity
      }
    }
    model.now = target
    return
  }
  // Activity only restarts the 2-minute countdown while green.
  if (action.type === "activity" && model.status === "active") model.next = model.now + REQ_IDLE_MS
  // Leaving opencode while green: yellow + check-in immediately.
  if (action.type === "away" && model.status === "active") {
    model.status = "idle"
    model.checkIns += 1
    model.next = model.now + REQ_RED_AFTER_MS
  }
  // Answering the check-in (either button) goes back to green and restarts the countdown.
  if (action.type === "answer" && model.status !== "active") {
    model.status = "active"
    model.next = model.now + REQ_IDLE_MS
  }
}

describe("R1: check-in and yellow after 2 min idle or leaving opencode, red after 60 s unanswered", () => {
  // R1: When the user leaves opencode or has no activity for 2 minutes during a work round,
  // a "Need help?" check-in appears and the status turns yellow. If the check-in stays
  // unanswered for 60 seconds, the status turns red.
  // Kind: model / oracle. The real idle monitor must agree with the simple R1 model above
  // after every step of any sequence of waits, activity, leaving and answers.
  test("R1 (model): idle monitor matches a reference model of the 2:00 / +1:00 rules", () => {
    fc.assert(
      fc.property(monitorActionsArb, (actions) => {
        const time = createFakeClock()
        const monitor = createIdleMonitor({ clock: time.clock })
        let checkIns = 0
        monitor.subscribe((event) => {
          if (event.type === "check-in") checkIns += 1
        })
        monitor.enable()
        const model: R1Model = { now: 0, status: "active", next: REQ_IDLE_MS, checkIns: 0 }

        for (const action of actions) {
          if (action.type === "advance") time.advance(action.ms)
          if (action.type === "activity") monitor.activity()
          if (action.type === "away") monitor.away()
          if (action.type === "answer") monitor.answer(action.needsHelp)
          r1ModelStep(model, action)

          expect(monitor.status()).toBe(model.status)
          expect(checkIns).toBe(model.checkIns)
        }
      }),
      { numRuns: 300 },
    )
  })

  // R1: "... a 'Need help?' check-in appears and the status turns yellow. If the check-in
  // stays unanswered for 60 seconds, the status turns red."
  // Kind: invariant. Over any whole session (including pauses, breaks and round ends):
  //   - yellow never appears without a check-in at the same moment,
  //   - red only ever follows yellow, exactly 60 s later, with no answer in between.
  test("R1 (invariant): yellow always comes with a check-in; red is always exactly 60 s of unanswered yellow", () => {
    fc.assert(
      fc.property(timingArb, sessionActionsArb, (timing, actions) => {
        const s = createSession()
        const statuses: Array<{ status: ActivityStatus; at: number }> = []
        const checkInTimes: number[] = []
        s.monitor.subscribe((event) => {
          if (event.type === "status") statuses.push({ status: event.status, at: s.time.clock.now() })
          if (event.type === "check-in") checkInTimes.push(s.time.clock.now())
        })
        s.start(timing)
        actions.forEach(s.apply)

        statuses.forEach((event, i) => {
          if (event.status === "idle") expect(checkInTimes).toContain(event.at)
          if (event.status === "unresponsive") {
            const previous = statuses[i - 1]
            expect(previous?.status).toBe("idle")
            expect(event.at - previous!.at).toBe(REQ_RED_AFTER_MS)
          }
        })
      }),
    )
  })

  // R1: "... during a work round ..."
  // Kind: invariant. Whatever the user does, the status is only ever green/yellow/red while
  // a work round is running and not paused; at every other moment it is neutral (grey), so
  // no check-in and no yellow/red can appear during breaks or pauses.
  test("R1 (invariant): status is non-neutral exactly when a work round is running and unpaused", () => {
    fc.assert(
      fc.property(timingArb, sessionActionsArb, (timing, actions) => {
        const s = createSession()
        s.start(timing)
        for (const action of actions) {
          s.apply(action)
          const snapshot = s.controller.snapshot()
          const tracking = snapshot.phase === "work" && !snapshot.paused
          expect(s.monitor.status() !== "neutral").toBe(tracking)
        }
      }),
    )
  })

  // R1: "When the user leaves opencode ... during a work round, a 'Need help?' check-in
  // appears and the status turns yellow." (acceptance: "Leaving the tab during a work round
  // gives yellow and a check-in immediately.")
  // Kind: invariant. For any history that leaves the user green in a running round,
  // leaving opencode turns the status yellow and fires exactly one check-in at that instant.
  test("R1 (invariant): leaving opencode while green gives yellow and one check-in immediately", () => {
    fc.assert(
      fc.property(longTimingArb, sessionActionsArb, (timing, actions) => {
        const s = createSession()
        s.start(timing)
        actions.forEach(s.apply)
        fc.pre(s.monitor.status() === "active")
        const before = s.checkIns.length
        const at = s.time.clock.now()

        s.apply({ type: "away" })

        expect(s.monitor.status()).toBe("idle")
        expect(s.checkIns.length).toBe(before + 1)
        expect(s.time.clock.now()).toBe(at)
      }),
    )
  })
})

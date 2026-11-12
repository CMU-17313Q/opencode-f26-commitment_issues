// Property-based tests for the Focus Session feature (Project 4B, noork): R4
//
// Each property names the requirement it checks (ID and wording, see traceability/noork.md)
// and its kind. Generators live in ./arbitraries.ts and are explained there; ./harness.ts
// wires the real controller, idle monitor, focus tracker and timeline together the same way
// session-store.ts does, on a fake clock.
import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { layoutTimeline } from "../../src/pages/home/focus-session/controller/focus-timeline"
import { timelineArb, timingArb } from "./arbitraries"
import { MINUTE, createSession } from "./harness"

// Floating-point tolerance for percentage comparisons (widths are % of the bar).
const EPS = 1e-9
const close = (a: number, b: number) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b))

// ---------------------------------------------------------------------------------------
// R4: A running round's length cannot be changed. A different length applies only to a
// newly started session. When stretches are laid out against a different total length,
// their order is unchanged and each width is its duration divided by the total.
// ---------------------------------------------------------------------------------------
describe("R4: round length is fixed once started; widths scale with the total", () => {
  // R4: "When stretches are laid out against a different total length, their order is
  // unchanged and each width is its duration divided by the total."
  // Kind: metamorphic. Laying the same stretches out against a k-times longer round (e.g.
  // 25 -> 50 min is k = 2) keeps the same colors in the same order and divides every width
  // and position by exactly k. Acceptance example: 4 min -> 25% each, 8 min -> 12.5% each.
  test("R4 (metamorphic): a k-times longer round keeps the color order and divides every width by k", () => {
    fc.assert(
      fc.property(timelineArb, fc.integer({ min: 2, max: 8 }), ({ segments, elapsedMs, totalMs }, k) => {
        const base = layoutTimeline(segments, elapsedMs, totalMs)
        const longer = layoutTimeline(segments, elapsedMs, totalMs * k)

        expect(longer.segments.map((x) => x.status)).toEqual(base.segments.map((x) => x.status))
        longer.segments.forEach((segment, i) => {
          expect(close(segment.width, base.segments[i]!.width / k)).toBe(true)
          expect(close(segment.left, base.segments[i]!.left / k)).toBe(true)
        })
      }),
      { numRuns: 300 },
    )
  })

  // R4: "... each width is its duration divided by the total."
  // Kind: metamorphic. If every stretch AND the round are scaled by the same factor (the
  // user behaved the same way, proportionally, in a longer round) the bar looks identical:
  // "the formatting, the consistency of everything" stays the same (C-12, C-13).
  test("R4 (metamorphic): scaling the stretches and the round together leaves the bar unchanged", () => {
    fc.assert(
      fc.property(timelineArb, fc.integer({ min: 2, max: 8 }), ({ segments, elapsedMs, totalMs }, k) => {
        const scaled = segments.map((x) => ({
          status: x.status,
          from: x.from * k,
          ...(x.to === undefined ? {} : { to: x.to * k }),
        }))
        const base = layoutTimeline(segments, elapsedMs, totalMs)
        const bigger = layoutTimeline(scaled, elapsedMs * k, totalMs * k)

        expect(bigger.segments.length).toBe(base.segments.length)
        bigger.segments.forEach((segment, i) => {
          expect(segment.status).toBe(base.segments[i]!.status)
          expect(close(segment.width, base.segments[i]!.width)).toBe(true)
          expect(close(segment.left, base.segments[i]!.left)).toBe(true)
        })
      }),
      { numRuns: 300 },
    )
  })

  // R4: "... their order is unchanged and each width is its duration divided by the total."
  // Kind: model / oracle. Compare layoutTimeline against the formula written in the
  // requirement: width = (to - from) / total * 100, left = from / total * 100, same order,
  // stretches drawn edge to edge, and the filled part equals elapsed / total.
  test("R4 (model): every width equals duration / total and stretches are drawn edge to edge", () => {
    fc.assert(
      fc.property(timelineArb, ({ segments, elapsedMs, totalMs }) => {
        const view = layoutTimeline(segments, elapsedMs, totalMs)

        expect(view.segments.map((x) => x.status)).toEqual(segments.map((x) => x.status))
        view.segments.forEach((drawn, i) => {
          const source = segments[i]!
          const to = source.to ?? elapsedMs
          expect(close(drawn.width, ((to - source.from) / totalMs) * 100)).toBe(true)
          expect(close(drawn.left, (source.from / totalMs) * 100)).toBe(true)
          if (i > 0) {
            const previous = view.segments[i - 1]!
            expect(close(previous.left + previous.width, drawn.left)).toBe(true)
          }
        })
        const filled = view.segments.reduce((sum, x) => sum + x.width, 0)
        expect(close(filled, (elapsedMs / totalMs) * 100)).toBe(true)
        expect(filled).toBeLessThanOrEqual(100 + EPS)
      }),
      { numRuns: 300 },
    )
  })

  // R4: "A running round's length cannot be changed. A different length applies only to a
  // newly started session."
  // Kind: invariant. For any running round A and any other timing B: changing the selection
  // (mutating the timing object the card passed in) or trying to start B while A runs does
  // not change the countdown; B only takes effect after A is ended and a new session starts.
  test("R4 (invariant): a running round keeps its length; a new length only applies to a new session", () => {
    fc.assert(
      fc.property(timingArb, timingArb, fc.integer({ min: 0, max: 10 * MINUTE }), (a, b, rawElapsed) => {
        const s = createSession()
        const selection = { ...a }
        const workMs = a.workMinutes * MINUTE
        const elapsed = Math.min(rawElapsed, workMs - 1)

        expect(s.controller.start({ timing: selection, volume: 1 })).toBe(true)
        s.apply({ type: "advance", ms: elapsed })
        // The user changes the timing on the card mid-round.
        selection.workMinutes = b.workMinutes
        selection.breakMinutes = b.breakMinutes
        expect(s.start(b)).toBe(false)

        expect(s.controller.snapshot().timing).toEqual(a)
        expect(s.controller.snapshot().remainingMs).toBe(workMs - elapsed)

        // A new session picks up the new length.
        s.controller.end()
        expect(s.start(b)).toBe(true)
        expect(s.controller.snapshot().remainingMs).toBe(b.workMinutes * MINUTE)
      }),
    )
  })
})

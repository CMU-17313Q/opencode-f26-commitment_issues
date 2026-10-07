import { describe, expect, test } from "bun:test"
import { IDLE_AFTER_MS, UNRESPONSIVE_AFTER_MS, createIdleMonitor, followSession } from "./idle-monitor"
import { createFocusSessionController } from "./session-controller"
import { createFakeAudio, createFakeClock } from "./test-fakes"

function setup() {
  const time = createFakeClock()
  const monitor = createIdleMonitor({ clock: time.clock })
  const events: string[] = []
  monitor.subscribe((event) => {
    if (event.type === "status") events.push(`status:${event.status}`)
    if (event.type === "check-in") events.push("check-in")
    if (event.type === "answered") events.push(`answered:${event.needsHelp ? "yes" : "no"}`)
  })
  return { time, monitor, events }
}

describe("idle status transitions", () => {
  test("starts neutral (grey) until enabled", () => {
    expect(setup().monitor.status()).toBe("neutral")
  })

  test("green while active, yellow after 2 minutes, red after no answer", () => {
    const s = setup()
    s.monitor.enable()
    expect(s.monitor.status()).toBe("active")
    s.time.advance(IDLE_AFTER_MS - 1)
    expect(s.monitor.status()).toBe("active")
    s.time.advance(1)
    expect(s.monitor.status()).toBe("idle")
    s.time.advance(UNRESPONSIVE_AFTER_MS)
    expect(s.monitor.status()).toBe("unresponsive")
    expect(s.events).toEqual(["status:active", "status:idle", "check-in", "status:unresponsive"])
  })

  test("activity while green restarts the 2 minute countdown", () => {
    const s = setup()
    s.monitor.enable()
    s.time.advance(IDLE_AFTER_MS - 1000)
    s.monitor.activity()
    s.time.advance(IDLE_AFTER_MS - 1000)
    expect(s.monitor.status()).toBe("active")
    s.time.advance(1000)
    expect(s.monitor.status()).toBe("idle")
  })

  test("activity does not dismiss the check-in; only an answer does", () => {
    const s = setup()
    s.monitor.enable()
    s.time.advance(IDLE_AFTER_MS)
    s.monitor.activity()
    expect(s.monitor.status()).toBe("idle")
  })

  test("answering returns to green and reports the answer", () => {
    for (const needsHelp of [true, false]) {
      const s = setup()
      s.monitor.enable()
      s.time.advance(IDLE_AFTER_MS + UNRESPONSIVE_AFTER_MS)
      expect(s.monitor.answer(needsHelp)).toBe(true)
      expect(s.monitor.status()).toBe("active")
      expect(s.events).toContain(`answered:${needsHelp ? "yes" : "no"}`)
      s.time.advance(IDLE_AFTER_MS)
      expect(s.monitor.status()).toBe("idle")
    }
  })

  test("answering without a check-in is ignored", () => {
    const s = setup()
    s.monitor.enable()
    expect(s.monitor.answer(true)).toBe(false)
  })

  test("leaving the tab checks in immediately, then turns red without an answer", () => {
    const s = setup()
    s.monitor.enable()
    s.time.advance(10_000)
    expect(s.monitor.away()).toBe(true)
    expect(s.monitor.status()).toBe("idle")
    expect(s.events).toEqual(["status:active", "status:idle", "check-in"])
    s.time.advance(UNRESPONSIVE_AFTER_MS)
    expect(s.monitor.status()).toBe("unresponsive")
  })

  test("leaving the tab is ignored when not tracking or already checked in", () => {
    const s = setup()
    expect(s.monitor.away()).toBe(false)
    s.monitor.enable()
    s.monitor.away()
    expect(s.monitor.away()).toBe(false)
    expect(s.events.filter((event) => event === "check-in")).toHaveLength(1)
  })

  test("disable goes grey and cancels pending timers", () => {
    const s = setup()
    s.monitor.enable()
    s.monitor.disable()
    expect(s.monitor.status()).toBe("neutral")
    expect(s.time.pending()).toBe(0)
  })
})

describe("followSession", () => {
  test("is green during work, grey when paused, on break and after ending", () => {
    const time = createFakeClock()
    const controller = createFocusSessionController({ clock: time.clock, audio: createFakeAudio().audio })
    const monitor = createIdleMonitor({ clock: time.clock })
    followSession(controller, monitor)
    expect(monitor.status()).toBe("neutral")

    controller.start({ timing: { workMinutes: 25, breakMinutes: 5 }, volume: 1 })
    expect(monitor.status()).toBe("active")
    controller.pause()
    expect(monitor.status()).toBe("neutral")
    controller.resume()
    expect(monitor.status()).toBe("active")

    time.advance(25 * 60_000)
    expect(controller.snapshot().phase).toBe("break")
    expect(monitor.status()).toBe("neutral")

    time.advance(5 * 60_000)
    controller.nextRound()
    expect(monitor.status()).toBe("active")
    controller.end()
    expect(monitor.status()).toBe("neutral")
  })

  test("a check-in during work turns red if unanswered", () => {
    const time = createFakeClock()
    const controller = createFocusSessionController({ clock: time.clock, audio: createFakeAudio().audio })
    const monitor = createIdleMonitor({ clock: time.clock })
    followSession(controller, monitor)
    controller.start({ timing: { workMinutes: 25, breakMinutes: 5 }, volume: 1 })
    time.advance(IDLE_AFTER_MS)
    expect(monitor.status()).toBe("idle")
    time.advance(UNRESPONSIVE_AFTER_MS)
    expect(monitor.status()).toBe("unresponsive")
  })
})

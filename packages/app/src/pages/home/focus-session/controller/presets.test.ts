import { describe, expect, test } from "bun:test"
import { FOCUS_PRESETS, resolveTiming, validateTiming } from "./presets"

describe("focus session presets", () => {
  test("offers 25/5 and 50/10", () => {
    expect(FOCUS_PRESETS.map((item) => item.timing)).toEqual([
      { workMinutes: 25, breakMinutes: 5 },
      { workMinutes: 50, breakMinutes: 10 },
    ])
  })

  test("resolves a preset regardless of custom input", () => {
    expect(resolveTiming("long", { workMinutes: "abc", breakMinutes: -1 })).toEqual({
      ok: true,
      timing: { workMinutes: 50, breakMinutes: 10 },
    })
  })

  test("resolves custom timing through validation", () => {
    expect(resolveTiming("custom", { workMinutes: "40", breakMinutes: "8" })).toEqual({
      ok: true,
      timing: { workMinutes: 40, breakMinutes: 8 },
    })
    expect(resolveTiming("custom", { workMinutes: 0, breakMinutes: 5 }).ok).toBe(false)
  })
})

describe("validateTiming", () => {
  test("accepts the boundary values", () => {
    expect(validateTiming({ workMinutes: 1, breakMinutes: 0 })).toEqual({
      ok: true,
      timing: { workMinutes: 1, breakMinutes: 0 },
    })
    expect(validateTiming({ workMinutes: 120, breakMinutes: 60 })).toEqual({
      ok: true,
      timing: { workMinutes: 120, breakMinutes: 60 },
    })
  })

  test("rejects work time outside 1-120", () => {
    for (const workMinutes of [0, 121, -5]) {
      const result = validateTiming({ workMinutes, breakMinutes: 5 })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain("Work time")
    }
  })

  test("rejects break time outside 0-60", () => {
    for (const breakMinutes of [-1, 61]) {
      const result = validateTiming({ workMinutes: 25, breakMinutes })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain("Break time")
    }
  })

  test("rejects non-integers and non-numeric input", () => {
    for (const workMinutes of [2.5, "2.5", "", "ten", NaN, Infinity, null, undefined]) {
      expect(validateTiming({ workMinutes, breakMinutes: 5 }).ok).toBe(false)
    }
    expect(validateTiming({ workMinutes: 25, breakMinutes: "1e1" }).ok).toBe(false)
  })

  test("accepts whole numbers typed as strings", () => {
    expect(validateTiming({ workMinutes: " 30 ", breakMinutes: "0" })).toEqual({
      ok: true,
      timing: { workMinutes: 30, breakMinutes: 0 },
    })
  })
})

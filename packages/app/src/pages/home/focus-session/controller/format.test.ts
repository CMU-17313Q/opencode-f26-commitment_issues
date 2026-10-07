import { describe, expect, test } from "bun:test"
import { formatRemaining } from "./format"

describe("formatRemaining", () => {
  test("formats minutes and seconds", () => {
    expect(formatRemaining(25 * 60_000)).toBe("25:00")
    expect(formatRemaining(65_000)).toBe("01:05")
    expect(formatRemaining(120 * 60_000)).toBe("120:00")
  })

  test("rounds partial seconds up and never goes negative", () => {
    expect(formatRemaining(1)).toBe("00:01")
    expect(formatRemaining(0)).toBe("00:00")
    expect(formatRemaining(-500)).toBe("00:00")
  })
})

export type FocusTiming = {
  workMinutes: number
  breakMinutes: number
}

export type FocusPresetID = "pomodoro" | "long" | "custom"

export const FOCUS_PRESETS = [
  { id: "pomodoro", label: "25 / 5", timing: { workMinutes: 25, breakMinutes: 5 } },
  { id: "long", label: "50 / 10", timing: { workMinutes: 50, breakMinutes: 10 } },
] as const satisfies ReadonlyArray<{ id: FocusPresetID; label: string; timing: FocusTiming }>

export const WORK_LIMITS = { min: 1, max: 120 }
export const BREAK_LIMITS = { min: 0, max: 60 }

export type TimingResult = { ok: true; timing: FocusTiming } | { ok: false; error: string }

// Inputs come straight from form fields, so accept strings as well as numbers.
export function validateTiming(input: { workMinutes: unknown; breakMinutes: unknown }): TimingResult {
  const work = parseMinutes(input.workMinutes)
  if (work === undefined || work < WORK_LIMITS.min || work > WORK_LIMITS.max)
    return {
      ok: false,
      error: `Work time must be a whole number from ${WORK_LIMITS.min} to ${WORK_LIMITS.max} minutes`,
    }
  const rest = parseMinutes(input.breakMinutes)
  if (rest === undefined || rest < BREAK_LIMITS.min || rest > BREAK_LIMITS.max)
    return {
      ok: false,
      error: `Break time must be a whole number from ${BREAK_LIMITS.min} to ${BREAK_LIMITS.max} minutes`,
    }
  return { ok: true, timing: { workMinutes: work, breakMinutes: rest } }
}

export function resolveTiming(preset: FocusPresetID, custom: { workMinutes: unknown; breakMinutes: unknown }) {
  const match = FOCUS_PRESETS.find((item) => item.id === preset)
  if (match) return { ok: true, timing: { ...match.timing } } satisfies TimingResult
  return validateTiming(custom)
}

function parseMinutes(value: unknown) {
  if (typeof value === "number") return Number.isInteger(value) ? value : undefined
  if (typeof value !== "string" || !/^\s*\d+\s*$/.test(value)) return undefined
  return Number(value)
}

export const LEVELS = ["beginner", "intermediate", "advanced"] as const
export type Level = (typeof LEVELS)[number]

// mcq: every question is multiple choice; frq: every question is free response; mixed: both.
export const FORMATS = ["mixed", "mcq", "frq"] as const
export type Format = (typeof FORMATS)[number]

// At least three questions so the quiz can mix three question types.
export const MIN_COUNT = 3
export const MAX_COUNT = 10
export const DEFAULT_COUNT = 5

export const USAGE = `/learn-quiz [file | --diff] [--count <${MIN_COUNT}-${MAX_COUNT}>] [--level ${LEVELS.join("|")}] [--format ${FORMATS.join("|")}] [-h | --help]`

export type Scope = { type: "file"; file: string } | { type: "diff" } | { type: "recent" }

export type Options = {
  scope: Scope
  count: number
  level: Level
  format: Format
}

export function parse(input: string): { ok: true; options: Options } | { ok: false; message: string } {
  // Accept both `--count 5` and `--count=5`.
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => (token.startsWith("--") && token.includes("=") ? token.split(/=(.*)/s, 2) : [token]))

  // The TUI shows a help dialog before this runs; other clients get the usage line instead of "Unknown option".
  if (tokens.some((token) => token === "-h" || token === "--help")) return { ok: false, message: `Usage: ${USAGE}` }

  const files: string[] = []
  const flags: { diff: boolean; count?: string; level?: string; format?: string } = { diff: false }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === "--diff") {
      flags.diff = true
      continue
    }
    if (token === "--count" || token === "--level" || token === "--format") {
      const value = tokens[i + 1]
      if (!value || value.startsWith("--")) return fail(missingValue(token))
      flags[token.slice(2) as "count" | "level" | "format"] = value
      i++
      continue
    }
    if (token.startsWith("-")) return fail(`Unknown option "${token}".`)
    files.push(token)
  }

  if (files.length > 1) return fail(`Only one file can be quizzed at a time, got ${files.length}: ${files.join(", ")}.`)
  if (files.length === 1 && flags.diff) return fail("Use either a file or --diff, not both.")

  const count = flags.count === undefined ? DEFAULT_COUNT : /^\d+$/.test(flags.count) ? Number(flags.count) : NaN
  if (!(count >= MIN_COUNT && count <= MAX_COUNT))
    return fail(`--count must be a whole number from ${MIN_COUNT} to ${MAX_COUNT}, got "${flags.count}".`)

  const level = LEVELS.find((item) => item === (flags.level ?? "intermediate").toLowerCase())
  if (!level) return fail(`--level must be one of ${LEVELS.join(", ")}, got "${flags.level}".`)

  const format = FORMATS.find((item) => item === (flags.format ?? "mixed").toLowerCase())
  if (!format) return fail(`--format must be one of ${FORMATS.join(", ")}, got "${flags.format}".`)

  return {
    ok: true,
    options: {
      scope: files[0] ? { type: "file", file: files[0] } : flags.diff ? { type: "diff" } : { type: "recent" },
      count,
      level,
      format,
    },
  }
}

// Settings block that replaces $ARGUMENTS in the template, so the model reads validated values rather than raw flags.
export function settings(options: Options) {
  return [
    `- Scope: ${describeScope(options.scope)}`,
    `- Number of questions: ${options.count}`,
    `- Level: ${options.level}`,
    `- Format: ${options.format}`,
  ].join("\n")
}

function describeScope(scope: Scope) {
  if (scope.type === "file") return `the file \`${scope.file}\``
  if (scope.type === "diff") return "uncommitted changes"
  return "recent changes"
}

function missingValue(flag: string) {
  if (flag === "--count") return `--count needs a number, for example --count ${DEFAULT_COUNT}.`
  if (flag === "--level") return `--level needs a value: ${LEVELS.join(", ")}.`
  return `--format needs a value: ${FORMATS.join(", ")}.`
}

function fail(message: string) {
  return { ok: false as const, message: `${message} Usage: ${USAGE}` }
}

export * as LearnQuiz from "./learn-quiz"

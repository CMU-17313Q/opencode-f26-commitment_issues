import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { LearnQuiz } from "../../src/command/learn-quiz"

// Generators
//
// The parser splits on whitespace, accepts `--flag value` and `--flag=value`, and ignores case for level and format,
// so the generators vary all of those. Every argument list is built from "segments" (a file, --diff, one option and
// its value) that are shuffled, because users type options in any order and the order must never matter.

const file = fc.stringMatching(/^[a-z][a-z0-9_]{0,8}(\/[a-z][a-z0-9_]{0,8}){0,2}\.(ts|py|rs|sml)$/)

// One or more spaces or tabs between tokens.
const gap = fc.constantFrom(" ", "  ", "\t", " \t ")

// Random upper/lower case, e.g. "AdVanced".
const anyCase = (value: string) =>
  fc
    .array(fc.boolean(), { minLength: value.length, maxLength: value.length })
    .map((upper) => [...value].map((char, i) => (upper[i] ? char.toUpperCase() : char)).join(""))

// `--flag value` or `--flag=value`.
const option = (flag: string, value: fc.Arbitrary<string>) =>
  fc.tuple(value, fc.boolean()).map(([text, joined]) => (joined ? [`${flag}=${text}`] : [flag, text]))

const validCount = fc.integer({ min: LearnQuiz.MIN_COUNT, max: LearnQuiz.MAX_COUNT })
const level = fc.constantFrom(...LearnQuiz.LEVELS).chain(anyCase)
const format = fc.constantFrom(...LearnQuiz.FORMATS).chain(anyCase)

// The scope: a file, --diff, or nothing (recent changes).
const scope = fc.oneof(
  fc.constant<string[]>([]),
  file.map((name) => [name]),
  fc.constant(["--diff"]),
)

// A valid argument list without --count, as shuffled segments, so tests can add --count themselves.
const segmentsWithoutCount = fc
  .tuple(
    scope,
    fc.option(option("--level", level), { nil: undefined }),
    fc.option(option("--format", format), { nil: undefined }),
  )
  .map((segments) => segments.filter((segment): segment is string[] => segment !== undefined && segment.length > 0))

function join(segments: string[][], gaps: string[]) {
  return segments
    .flat()
    .map((token, i) => (i === 0 ? token : `${gaps[i % gaps.length]}${token}`))
    .join("")
}

// Shuffles the segments and joins them with random whitespace.
function argumentsOf(segments: fc.Arbitrary<string[][]>) {
  return segments
    .chain((items) => fc.shuffledSubarray(items, { minLength: items.length, maxLength: items.length }))
    .chain((items) => fc.array(gap, { minLength: 1, maxLength: 4 }).map((gaps) => join(items, gaps)))
}

// Counts the parser must refuse: whole numbers just outside the range (the boundaries interviewees asked about) and
// far outside it, negatives, decimals, exponents, signs, words, and non-ASCII digits.
const badCount = fc.oneof(
  fc.integer({ min: -1000, max: LearnQuiz.MIN_COUNT - 1 }).map(String),
  fc.integer({ min: LearnQuiz.MAX_COUNT + 1, max: 100_000 }).map(String),
  fc.constantFrom("2", "11", "0", "50", "4.5", "3.0", "1e1", "+5", "five", "５", "10x", "x"),
  fc.stringMatching(/^[a-z]{1,6}$/),
)

const badLevel = fc.stringMatching(/^[a-z]{1,12}$/).filter((value) => !LearnQuiz.LEVELS.some((item) => item === value))
const badFormat = fc.stringMatching(/^[a-z]{1,8}$/).filter((value) => !LearnQuiz.FORMATS.some((item) => item === value))

// Options the parser does not know, including near-miss typos of real ones (`--cout`, `--levels`, `--COUNT`).
const unknownOption = fc
  .oneof(
    fc.constantFrom("--cout", "--counts", "--levels", "--fromat", "--COUNT", "--Diff", "-c", "-d", "-", "--"),
    fc.stringMatching(/^--?[a-z][a-z-]{0,10}$/),
  )
  .filter((flag) => !["--diff", "--count", "--level", "--format", "-h", "--help"].includes(flag))

// One invalid piece of input, paired with the option the error message has to name.
const invalid = fc.oneof(
  badCount.chain((value) => option("--count", fc.constant(value))).map((tokens) => ({ tokens, names: "--count" })),
  badLevel.chain((value) => option("--level", fc.constant(value))).map((tokens) => ({ tokens, names: "--level" })),
  badFormat.chain((value) => option("--format", fc.constant(value))).map((tokens) => ({ tokens, names: "--format" })),
  unknownOption.map((flag) => ({ tokens: [flag], names: flag })),
  // --diff takes no value; whatever follows "=" must not turn into a file name.
  fc.oneof(file, fc.constantFrom("", "yes", "true")).map((value) => ({ tokens: [`--diff=${value}`], names: "--diff" })),
)

// A repeated option, even with a valid second value, must be refused so the first value is never silently dropped.
const repeated = fc.oneof(
  fc
    .tuple(option("--count", fc.oneof(badCount, validCount.map(String))), option("--count", validCount.map(String)))
    .map(([first, second]) => ({ segments: [first, second], names: "--count" })),
  fc
    .tuple(option("--level", level), option("--level", level))
    .map(([first, second]) => ({ segments: [first, second], names: "--level" })),
  fc
    .tuple(option("--format", format), option("--format", format))
    .map(([first, second]) => ({ segments: [first, second], names: "--format" })),
  fc.constant({ segments: [["--diff"], ["--diff"]] as string[][], names: "--diff" }),
)

// The part of an error before the usage line. The usage line itself mentions every option, so checking the whole
// message for an option name would always pass.
function reason(message: string) {
  return message.slice(0, -`Usage: ${LearnQuiz.USAGE}`.length)
}

describe("/learn-quiz argument properties", () => {
  // R1: Invalid or unknown options must be rejected with a clear error and the usage line before anything is sent to
  // the model. They should never be capped, ignored, or treated as a file name.
  // Kind: invariant
  //
  // The session only builds the prompt when parse() returns ok (SessionPrompt.learnQuizSettings fails the command
  // otherwise, and prompt.test.ts checks that a failed parse stores no message), so "rejected by parse" is "nothing
  // reaches the model".
  //
  // Generator: a random valid argument list with exactly one invalid piece shuffled in at any position. A valid option
  // with the same name is dropped first, so the invalid piece is the only thing wrong with the input.
  test("R1: any argument list with one invalid option is rejected, names the option, and shows the usage line", () => {
    const input = fc
      .tuple(segmentsWithoutCount, fc.option(option("--count", validCount.map(String)), { nil: undefined }), invalid)
      .chain(([base, count, bad]) =>
        argumentsOf(
          fc.constant([
            ...[...base, ...(count ? [count] : [])].filter((segment) => segment[0].split("=")[0] !== bad.names),
            bad.tokens,
          ]),
        ).map((text) => ({ text, names: bad.names })),
      )
    fc.assert(
      fc.property(input, (item) => {
        const parsed = LearnQuiz.parse(item.text)
        expect(parsed.ok).toBe(false)
        if (parsed.ok) return
        expect(parsed.message).toEndWith(`Usage: ${LearnQuiz.USAGE}`)
        expect(reason(parsed.message)).toContain(item.names)
      }),
      { numRuns: 500 },
    )
  })

  // R1 (continued): an option given twice is refused, not resolved by keeping one of the values.
  // Kind: invariant
  test("R1: an option given twice is rejected instead of keeping one value", () => {
    fc.assert(
      fc.property(
        repeated.chain((item) =>
          argumentsOf(fc.constant(item.segments)).map((input) => ({ input, names: item.names })),
        ),
        (item) => {
          const parsed = LearnQuiz.parse(item.input)
          expect(parsed.ok).toBe(false)
          if (parsed.ok) return
          expect(parsed.message).toEndWith(`Usage: ${LearnQuiz.USAGE}`)
          expect(reason(parsed.message)).toContain(item.names)
        },
      ),
      { numRuns: 300 },
    )
  })

  // R1 (continued): whatever the student types, an accepted quiz never has an out-of-range count, an unknown level
  // or format, or an option mistaken for a file; and a rejected one always says how to use the command.
  // Kind: invariant
  //
  // Generator: free-form token soup drawn from real options, values near the boundaries, and file-like words, so
  // most inputs are invalid in some way and some happen to be valid.
  test("R1: every accepted argument list has in-range settings, and every rejection ends with the usage line", () => {
    const token = fc.oneof(
      fc.constantFrom("--diff", "--count", "--level", "--format", "--cout", "-x", "--", "-", "=", "--count="),
      fc.integer({ min: -2, max: 12 }).map(String),
      fc.constantFrom(...LearnQuiz.LEVELS, ...LearnQuiz.FORMATS, "expert", "essay"),
      option("--count", fc.integer({ min: -2, max: 12 }).map(String)).map((tokens) => tokens.join(" ")),
      option("--diff", fc.constantFrom("", "x")).map((tokens) => tokens.join(" ")),
      file,
    )
    fc.assert(
      fc.property(fc.array(token, { maxLength: 8 }), gap, (tokens, space) => {
        const parsed = LearnQuiz.parse(tokens.join(space))
        if (!parsed.ok) {
          expect(parsed.message).toEndWith(`Usage: ${LearnQuiz.USAGE}`)
          return
        }
        expect(parsed.options.count).toBeGreaterThanOrEqual(LearnQuiz.MIN_COUNT)
        expect(parsed.options.count).toBeLessThanOrEqual(LearnQuiz.MAX_COUNT)
        expect(LearnQuiz.LEVELS).toContain(parsed.options.level)
        expect(LearnQuiz.FORMATS).toContain(parsed.options.format)
        if (parsed.options.scope.type === "file") {
          expect(parsed.options.scope.file).not.toStartWith("-")
          expect(parsed.options.scope.file).not.toBe("")
        }
      }),
      { numRuns: 1000 },
    )
  })

  // R2: The count the student gives with --count reaches the model unchanged, and changing only --count changes
  // nothing else the model receives.
  // Kind: metamorphic
  //
  // Generator: the same random valid argument list (scope, level, format in any order, case, and spacing) is run
  // twice with two different counts, in either `--count n` or `--count=n` form, or once with no --count at all.
  test("R2: changing only --count changes only the number of questions sent to the model", () => {
    fc.assert(
      fc.property(
        segmentsWithoutCount,
        fc.option(validCount, { nil: undefined }),
        fc.option(validCount, { nil: undefined }),
        fc.boolean(),
        fc.array(gap, { minLength: 1, maxLength: 3 }),
        (segments, first, second, joined, gaps) => {
          const run = (count: number | undefined) => {
            const flag = count === undefined ? [] : [joined ? [`--count=${count}`] : ["--count", String(count)]]
            const parsed = LearnQuiz.parse(join([...segments, ...flag], gaps))
            if (!parsed.ok) throw new Error(`valid arguments were rejected: ${parsed.message}`)
            return parsed.options
          }
          const a = run(first)
          const b = run(second)

          // The count is exactly what was asked for (or the default), never capped or adjusted.
          expect(a.count).toBe(first ?? LearnQuiz.DEFAULT_COUNT)
          expect(b.count).toBe(second ?? LearnQuiz.DEFAULT_COUNT)
          // Every other option is identical.
          expect({ ...a, count: 0 }).toEqual({ ...b, count: 0 })

          // What the model reads differs in the "Number of questions" line and nowhere else.
          const linesA = LearnQuiz.settings(a).split("\n")
          const linesB = LearnQuiz.settings(b).split("\n")
          expect(linesA).toHaveLength(linesB.length)
          const changed = linesA.flatMap((line, i) => (line === linesB[i] ? [] : [i]))
          const countLine = linesA.findIndex((line) => line.startsWith("- Number of questions:"))
          expect(changed).toEqual(a.count === b.count ? [] : [countLine])
          expect(linesA[countLine]).toBe(`- Number of questions: ${a.count}`)
          expect(linesB[countLine]).toBe(`- Number of questions: ${b.count}`)
        },
      ),
      { numRuns: 500 },
    )
  })
})

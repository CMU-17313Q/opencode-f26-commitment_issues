import { describe, expect, test } from "bun:test"
import { LearnQuiz } from "../../src/command/learn-quiz"

function options(input: string) {
  const parsed = LearnQuiz.parse(input)
  if (!parsed.ok) throw new Error(`expected "${input}" to parse, got: ${parsed.message}`)
  return parsed.options
}

function error(input: string) {
  const parsed = LearnQuiz.parse(input)
  if (parsed.ok) throw new Error(`expected "${input}" to be rejected`)
  return parsed.message
}

describe("/learn-quiz argument parsing", () => {
  test("defaults to recent changes, a short quiz, intermediate depth, and mixed questions", () => {
    expect(options("")).toEqual({
      scope: { type: "recent" },
      count: LearnQuiz.DEFAULT_COUNT,
      level: "intermediate",
      format: "mixed",
    })
    expect(options("   ")).toEqual(options(""))
  })

  test("a bare argument scopes the quiz to that file", () => {
    expect(options("src/app.ts").scope).toEqual({ type: "file", file: "src/app.ts" })
  })

  test("--diff scopes the quiz to uncommitted changes", () => {
    expect(options("--diff").scope).toEqual({ type: "diff" })
  })

  test("--count sets the number of questions", () => {
    expect(options("--count 3").count).toBe(3)
    expect(options("--count=7").count).toBe(7)
    expect(options(`--count ${LearnQuiz.MAX_COUNT}`).count).toBe(LearnQuiz.MAX_COUNT)
  })

  test("--level sets the depth, ignoring case", () => {
    expect(options("--level beginner").level).toBe("beginner")
    expect(options("--level=advanced").level).toBe("advanced")
    expect(options("--level Advanced").level).toBe("advanced")
  })

  test("--format picks multiple choice only, free response only, or mixed, ignoring case", () => {
    expect(options("--format mcq").format).toBe("mcq")
    expect(options("--format=frq").format).toBe("frq")
    expect(options("--format MIXED").format).toBe("mixed")
  })

  test("flags combine in any order", () => {
    expect(options("--level advanced src/app.ts --format frq --count 4")).toEqual({
      scope: { type: "file", file: "src/app.ts" },
      count: 4,
      level: "advanced",
      format: "frq",
    })
    expect(options("--count 6 --diff --level beginner")).toEqual({
      scope: { type: "diff" },
      count: 6,
      level: "beginner",
      format: "mixed",
    })
  })

  test("rejects unknown options", () => {
    expect(error("--levels advanced")).toContain('Unknown option "--levels".')
    expect(error("-d")).toContain('Unknown option "-d".')
  })

  test("rejects a count that is not a whole number in range", () => {
    for (const value of ["abc", "2", "11", "0", "4.5", "-3"]) {
      expect(error(`--count ${value}`)).toContain(
        `--count must be a whole number from ${LearnQuiz.MIN_COUNT} to ${LearnQuiz.MAX_COUNT}, got "${value}".`,
      )
    }
  })

  test("rejects an unknown level", () => {
    expect(error("--level expert")).toContain('--level must be one of beginner, intermediate, advanced, got "expert".')
  })

  test("rejects an unknown format", () => {
    expect(error("--format essay")).toContain('--format must be one of mixed, mcq, frq, got "essay".')
  })

  test("rejects flags with a missing value", () => {
    expect(error("--count")).toContain("--count needs a number")
    expect(error("--count=")).toContain("--count needs a number")
    expect(error("--count --diff")).toContain("--count needs a number")
    expect(error("--level")).toContain("--level needs a value")
    expect(error("--format")).toContain("--format needs a value: mixed, mcq, frq.")
  })

  test("rejects a file together with --diff", () => {
    expect(error("src/app.ts --diff")).toContain("Use either a file or --diff, not both.")
  })

  test("rejects more than one file", () => {
    expect(error("a.ts b.ts")).toContain("Only one file can be quizzed at a time, got 2: a.ts, b.ts.")
  })

  test("-h and --help anywhere answer with just the usage line", () => {
    for (const input of ["-h", "--help", "src/app.ts --count 3 --help", "--bogus -h"]) {
      expect(error(input)).toBe(`Usage: ${LearnQuiz.USAGE}`)
    }
  })

  test("every error ends with the usage line", () => {
    expect(error("--bogus")).toEndWith(`Usage: ${LearnQuiz.USAGE}`)
    expect(LearnQuiz.USAGE).toBe(
      "/learn-quiz [file | --diff] [--count <3-10>] [--level beginner|intermediate|advanced] [--format mixed|mcq|frq] [-h | --help]",
    )
  })
})

describe("/learn-quiz settings for the template", () => {
  test("describes each scope, the count, the level, and the format", () => {
    expect(LearnQuiz.settings(options("src/app.ts --count 4 --level beginner --format mcq"))).toBe(
      ["- Scope: the file `src/app.ts`", "- Number of questions: 4", "- Level: beginner", "- Format: mcq"].join("\n"),
    )
    expect(LearnQuiz.settings(options("--diff"))).toContain("- Scope: uncommitted changes")
    expect(LearnQuiz.settings(options(""))).toContain("- Scope: recent changes")
  })
})

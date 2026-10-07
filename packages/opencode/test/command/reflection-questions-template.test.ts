import { describe, expect, test } from "bun:test"
import { Command } from "../../src/command"
import REFLECTION_QUESTIONS from "../../src/command/template/learn-quiz.txt"

describe("reflection questions template", () => {
  test("takes the code to reflect on through $ARGUMENTS", () => {
    expect(Command.hints(REFLECTION_QUESTIONS)).toEqual(["$ARGUMENTS"])
  })

  test("falls back to the student's recent work when there is no input", () => {
    expect(REFLECTION_QUESTIONS).toContain("Use the student's recent work")
    expect(REFLECTION_QUESTIONS).toContain("git diff")
  })

  test("asks for a short set of questions grounded in the code", () => {
    expect(REFLECTION_QUESTIONS).toContain("Write 3 to 5 questions")
    expect(REFLECTION_QUESTIONS).toContain("Ground every question in something specific")
  })

  test("asks the student to explain why choices were made", () => {
    expect(REFLECTION_QUESTIONS).toContain("**Why**")
    expect(REFLECTION_QUESTIONS).toContain("**Tradeoffs**")
  })

  test("includes a what-if question when relevant", () => {
    expect(REFLECTION_QUESTIONS).toContain("**What if**")
    expect(REFLECTION_QUESTIONS).toContain('"what would happen if..."')
    expect(REFLECTION_QUESTIONS).toContain("Include at least one")
  })

  test("promotes understanding instead of recall", () => {
    expect(REFLECTION_QUESTIONS).toContain("Do not ask the student to recall syntax")
  })

  test("does not reveal answers or rewrite the code", () => {
    expect(REFLECTION_QUESTIONS).toContain("Do not give away answers")
    expect(REFLECTION_QUESTIONS).toContain("Do not rewrite the code")
  })

  test("does not assume a language or framework", () => {
    expect(REFLECTION_QUESTIONS).toContain("Identify the language and framework")
    expect(REFLECTION_QUESTIONS).toContain("Do not assume any particular one")
  })

  test("asks the questions through the interactive quiz instead of printing them", () => {
    expect(REFLECTION_QUESTIONS).toContain("do not write the questions in your reply")
    expect(REFLECTION_QUESTIONS).toContain("single call to the `question` tool")
    expect(REFLECTION_QUESTIONS).toContain("an empty `options` list")
  })

  test("handles skipped questions and a dismissed quiz", () => {
    expect(REFLECTION_QUESTIONS).toContain('"Unanswered" was skipped')
    expect(REFLECTION_QUESTIONS).toContain("dismisses the quiz, stop")
  })

  test("uses a clear student-friendly output format", () => {
    expect(REFLECTION_QUESTIONS).toContain("short numbered list")
    expect(REFLECTION_QUESTIONS).toContain("one or two sentences")
    expect(REFLECTION_QUESTIONS).toContain("clear and encouraging, not condescending")
    expect(REFLECTION_QUESTIONS).toContain("answer in their own words")
})
})

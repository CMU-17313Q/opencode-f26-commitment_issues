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

  test("asks for the number of questions in the settings, grounded in the code", () => {
    expect(REFLECTION_QUESTIONS).toContain("Write exactly the number of questions given in the settings")
    expect(REFLECTION_QUESTIONS).toContain("Ground every question in something specific")
    expect(REFLECTION_QUESTIONS).toContain("Never use generic textbook examples")
  })

  test("offers all five question types", () => {
    expect(REFLECTION_QUESTIONS).toContain("**Design justification**")
    expect(REFLECTION_QUESTIONS).toContain("**Alternative scenario**")
    expect(REFLECTION_QUESTIONS).toContain("**Trade-off comparison**")
    expect(REFLECTION_QUESTIONS).toContain("**Predict the behavior**")
    expect(REFLECTION_QUESTIONS).toContain("**Concept check (multiple choice)**")
  })

  test("mixes at least three types, always with design justification and alternative scenario", () => {
    expect(REFLECTION_QUESTIONS).toContain("Use at least three different types")
    expect(REFLECTION_QUESTIONS).toContain(
      "Always include at least one design justification question and at least one alternative scenario question",
    )
    expect(REFLECTION_QUESTIONS).toContain('"what would happen if..."')
  })

  test("matches the answer format to each format setting", () => {
    expect(REFLECTION_QUESTIONS).toContain("format in the settings")
    expect(REFLECTION_QUESTIONS).toContain("- **mixed**: Include one or two concept checks as multiple choice.")
    expect(REFLECTION_QUESTIONS).toContain("- **mcq**: Ask every question as multiple choice")
    expect(REFLECTION_QUESTIONS).toContain("- **frq**: Ask every question as an open question")
    expect(REFLECTION_QUESTIONS).toContain("Do not ask concept checks.")
  })

  test("matches question depth to each level", () => {
    expect(REFLECTION_QUESTIONS).toContain("level in the settings")
    expect(REFLECTION_QUESTIONS).toContain("- **beginner**:")
    expect(REFLECTION_QUESTIONS).toContain("- **intermediate**:")
    expect(REFLECTION_QUESTIONS).toContain("- **advanced**:")
  })

  test("reads the code for each scope", () => {
    expect(REFLECTION_QUESTIONS).toContain("- **A file**:")
    expect(REFLECTION_QUESTIONS).toContain("- **Uncommitted changes**:")
    expect(REFLECTION_QUESTIONS).toContain("- **Recent changes**:")
    expect(REFLECTION_QUESTIONS).toContain("there is nothing uncommitted to quiz on")
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

  test("asks multiple choice questions without hinting at the answer", () => {
    expect(REFLECTION_QUESTIONS).toContain("give 3 or 4 options with exactly one correct")
    expect(REFLECTION_QUESTIONS).toContain("Never mark or hint at the correct option")
  })

  test("grades multiple choice questions and shows the result", () => {
    expect(REFLECTION_QUESTIONS).toContain("grade only the multiple choice questions")
    expect(REFLECTION_QUESTIONS).toContain("`Question N: Correct`")
    expect(REFLECTION_QUESTIONS).toContain('`Question N: Incorrect. The answer is "<label>".`')
    expect(REFLECTION_QUESTIONS).toContain('`Question N: Skipped. The answer is "<label>".`')
    expect(REFLECTION_QUESTIONS).toContain("Do not grade open questions")
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

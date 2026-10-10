import { describe, expect, test } from "bun:test"
import { calculateResult, parseGrade, parseMockExam, validateSettings, weakTopics } from "./mock-exam"
import { examJSON, fixtureDNA, settings } from "./mock-exam.fixtures"


describe("mock exam validation and deterministic grades", () => {
  test("valid settings and 2 original questions", () => {
    validateSettings(settings)
    const exam = parseMockExam(examJSON, settings, fixtureDNA)
    expect(exam.questions).toHaveLength(2)
    expect(exam.questions[1]?.referenceAnswer).toBe("Detect regressions")
  })
  test("rejects bad question counts, topics and retake duplicates", () => {
    expect(() => validateSettings({ ...settings, questionCount: 0 })).toThrow()
    expect(() => parseMockExam(examJSON, { ...settings, questionCount: 3 }, fixtureDNA)).toThrow()
    expect(() => parseMockExam(examJSON.replaceAll('"Testing"','"Invented"'), settings, fixtureDNA)).toThrow()
    expect(() => parseMockExam(examJSON, settings, fixtureDNA, ["How do unit tests work?"])).toThrow()
    expect(() => parseMockExam("{oops", settings, fixtureDNA)).toThrow()
  })
  test("grades, computes weighted topic scores, and identifies weakness", () => {
    const exam = parseMockExam(examJSON, settings, fixtureDNA)
    const grade = parseGrade('{"grades":[{"questionId":"q2","earnedPoints":0,"feedback":"Missing"},{"questionId":"q1","earnedPoints":3,"feedback":"Partial"}]}', exam)
    const result = calculateResult(exam, { q1: "Some answer" }, grade)
    expect(result.totalPossible).toBe(10)
    expect(result.totalEarned).toBe(3)
    expect(result.percentage).toBe(30)
    expect(result.topics[0]?.percentage).toBe(30)
    expect(weakTopics(result)).toEqual(["Testing"])
  })
  test("rejects duplicate, missing, over-max and negative grade scores", () => {
    const exam = parseMockExam(examJSON, settings, fixtureDNA)
    for (const bad of [
      [{ questionId: "q1", earnedPoints: 8, feedback: "Bad" }, { questionId: "q2", earnedPoints: 1, feedback: "Good" }],
      [{ questionId: "q1", earnedPoints: 3, feedback: "Good" }, { questionId: "q1", earnedPoints: 2, feedback: "Duplicate" }],
      [{ questionId: "q1", earnedPoints: -1, feedback: "Bad" }, { questionId: "q2", earnedPoints: 1, feedback: "Good" }],
    ]) expect(() => parseGrade(JSON.stringify({ grades: bad }), exam)).toThrow()
  })
})

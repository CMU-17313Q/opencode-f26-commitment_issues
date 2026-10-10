import { describe, expect, test } from "bun:test"
import { validateExamDNA } from "./exam-dna-validation"

const evidence = {
  documentId: "exam-1",
  location: "Question 2",
  description: "Requires writing a SQL JOIN query.",
}

function validDNA() {
  return {
    analyzedExamIds: ["exam-1"],
    typicalQuestionCount: 6,
    typicalDurationMinutes: 75,
    difficulty: "mixed",
    questionTypes: [
      {
        kind: "problem-solving",
        observedCount: 4,
        evidence: [evidence],
      },
    ],
    topics: [
      {
        name: "SQL JOINs",
        observedCount: 2,
        evidence: [evidence],
      },
    ],
    observations: ["Includes query-writing questions."],
    limitations: ["Only one past exam was analyzed."],
  }
}

const ids = ["exam-1", "exam-2"]

describe("AI-xam Exam DNA validation", () => {
  test("accepts valid structured Exam DNA", () => {
    const result = validateExamDNA(validDNA(), ids)
    expect(result.ok).toBe(true)
  })

  test("allows unknown question counts and durations", () => {
    const dna = {
      ...validDNA(),
      typicalQuestionCount: null,
      typicalDurationMinutes: null,
      difficulty: "unknown",
    }

    expect(validateExamDNA(dna, ids).ok).toBe(true)
  })

  test("rejects malformed responses", () => {
    expect(validateExamDNA(null, ids).ok).toBe(false)
    expect(validateExamDNA("not JSON", ids).ok).toBe(false)
    expect(validateExamDNA([], ids).ok).toBe(false)
  })

  test("rejects unknown source documents", () => {
    const dna = {
      ...validDNA(),
      analyzedExamIds: ["nonexistent-exam"],
    }

    expect(validateExamDNA(dna, ids).ok).toBe(false)
  })

  test("rejects unsupported evidence references", () => {
    const dna = validDNA()
    dna.topics[0]!.evidence = [{
      ...evidence,
      documentId: "unrelated-document",
    }]

    expect(validateExamDNA(dna, ids).ok).toBe(false)
  })

  test("rejects unsupported question formats", () => {
    const dna = validDNA()
    dna.questionTypes[0]!.kind = "unknown-format"

    expect(validateExamDNA(dna, ids).ok).toBe(false)
  })

  test("rejects invalid numeric estimates", () => {
    const dna = {
      ...validDNA(),
      typicalQuestionCount: -5,
      typicalDurationMinutes: 0,
    }

    expect(validateExamDNA(dna, ids).ok).toBe(false)
  })

  test("rejects duplicate exam identifiers", () => {
    const dna = {
      ...validDNA(),
      analyzedExamIds: ["exam-1", "exam-1"],
    }

    expect(validateExamDNA(dna, ids).ok).toBe(false)
  })

  test("requires evidence for identified patterns", () => {
    const dna = validDNA()
    dna.topics[0]!.evidence = []

    expect(validateExamDNA(dna, ids).ok).toBe(false)
  })
})

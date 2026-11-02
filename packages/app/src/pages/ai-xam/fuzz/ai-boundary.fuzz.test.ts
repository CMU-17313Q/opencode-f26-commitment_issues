import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import {
  MAX_DOCUMENT_BYTES,
  validateDocument,
} from "../domain/document-validation"
import { addDocuments, MAX_DOCUMENTS_PER_CATEGORY } from "../domain/documents"
import { validateExamDNA } from "../domain/exam-dna-validation"
import { fixtureDNA, examJSON, settings } from "../domain/mock-exam.fixtures"
import {
  calculateResult,
  parseGrade,
  parseMockExam,
  parseModelJSON,
} from "../domain/mock-exam"

// Every property checks 200 different generated cases. If an assertion fails,
// fast-check prints the seed, path, and shrunk counterexample for reproduction.
const NUM_RUNS = 200
const config = { numRuns: NUM_RUNS }
const validExtension = fc.constantFrom("pdf", "txt", "md")
const parsedFixtureExam = parseMockExam(examJSON, settings, fixtureDNA)

describe("AI Boundary Fuzzing: documents", () => {
  test("accepts every valid supported format with an allowed positive size", () => {
    fc.assert(
      fc.property(
        validExtension,
        fc.integer({ min: 1, max: MAX_DOCUMENT_BYTES }),
        (extension, size) => {
          const result = validateDocument({ name: `study.${extension}`, size })
          expect(result.valid).toBe(true)
          if (result.valid) expect(result.format).toBe(extension)
        },
      ),
      config,
    )
  })

  test("never accepts a document exceeding the size limit", () => {
    fc.assert(
      fc.property(
        validExtension,
        fc.integer({ min: 1, max: 1_000_000 }),
        (extension, overage) => {
          expect(
            validateDocument({ name: `study.${extension}`, size: MAX_DOCUMENT_BYTES + overage }).valid,
          ).toBe(false)
        },
      ),
      config,
    )
  })

  test("rejects unsupported file extensions regardless of size", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("exe", "zip", "js", "docx", "html"),
        fc.integer({ min: 1, max: MAX_DOCUMENT_BYTES }),
        (extension, size) => {
          expect(validateDocument({ name: `input.${extension}`, size }).valid).toBe(false)
        },
      ),
      config,
    )
  })

  test("rejects duplicate filenames even when the casing differs", () => {
    fc.assert(
      fc.property(validExtension, (extension) => {
        expect(
          validateDocument(
            { name: `EXAM.${extension.toUpperCase()}`, size: 100 },
            [`exam.${extension}`],
          ).valid,
        ).toBe(false)
      }),
      config,
    )
  })

  test("never adds more than six documents in one category", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20 }), (count) => {
        const files = Array.from(
          { length: count },
          (_, index) => new File(["x"], `input-${index}.txt`),
        )
        let nextId = 0
        const result = addDocuments([], files, "past-exam", () => `f-${nextId++}`)
        expect(result.documents.length).toBe(Math.min(count, MAX_DOCUMENTS_PER_CATEGORY))
        expect(result.documents.length).toBeLessThanOrEqual(MAX_DOCUMENTS_PER_CATEGORY)
        expect(result.errors.length).toBe(Math.max(0, count - MAX_DOCUMENTS_PER_CATEGORY))
      }),
      config,
    )
  })
})

describe("AI Boundary Fuzzing: generated Exam DNA", () => {
  test("never accepts evidence referring to an unapproved source document", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (suffix) => {
        const dna = structuredClone(fixtureDNA)
        dna.topics[0]!.evidence[0]!.documentId = `unapproved-${suffix}`
        expect(validateExamDNA(dna, ["exam-1"]).ok).toBe(false)
      }),
      config,
    )
  })

  test("never accepts zero or negative question count estimates", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 0 }), (count) => {
        const dna = { ...fixtureDNA, typicalQuestionCount: count }
        expect(validateExamDNA(dna, ["exam-1"]).ok).toBe(false)
      }),
      config,
    )
  })
})

describe("AI Boundary Fuzzing: mock exams and grading", () => {
  test("rejects duplicated question identifiers in model-generated exams", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 30 }), (suffix) => {
        const payload = JSON.parse(examJSON) as {
          title: string
          questions: Array<{ id: string }>
        }
        const duplicatedId = `same-${suffix}`
        payload.questions[0]!.id = duplicatedId
        payload.questions[1]!.id = duplicatedId
        expect(() => parseMockExam(JSON.stringify(payload), settings, fixtureDNA)).toThrow()
      }),
      config,
    )
  })

  test("never accepts a model grade above a question's maximum", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (excess) => {
        const grade = {
          grades: [
            { questionId: "q1", earnedPoints: 5 + excess, feedback: "Scored" },
            { questionId: "q2", earnedPoints: 0, feedback: "Scored" },
          ],
        }
        expect(() => parseGrade(JSON.stringify(grade), parsedFixtureExam)).toThrow()
      }),
      config,
    )
  })

  test("never accepts negative model grades", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (magnitude) => {
        const grade = {
          grades: [
            { questionId: "q1", earnedPoints: -magnitude, feedback: "Scored" },
            { questionId: "q2", earnedPoints: 0, feedback: "Scored" },
          ],
        }
        expect(() => parseGrade(JSON.stringify(grade), parsedFixtureExam)).toThrow()
      }),
      config,
    )
  })

  test("valid grades always produce accurate totals and bounded percentages", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        (first, second) => {
          const grade = parseGrade(
            JSON.stringify({
              grades: [
                { questionId: "q1", earnedPoints: first, feedback: "Scored" },
                { questionId: "q2", earnedPoints: second, feedback: "Scored" },
              ],
            }),
            parsedFixtureExam,
          )
          const result = calculateResult(parsedFixtureExam, {}, grade)
          expect(result.totalEarned).toBe(first + second)
          expect(result.totalPossible).toBe(10)
          expect(result.percentage).toBe((first + second) * 10)
          expect(result.percentage).toBeGreaterThanOrEqual(0)
          expect(result.percentage).toBeLessThanOrEqual(100)
          expect(result.topics[0]?.percentage).toBe(result.percentage)
        },
      ),
      config,
    )
  })

  test("malformed AI JSON is rejected instead of being used", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 80 }), (suffix) => {
        expect(() => parseModelJSON(`not-json:${suffix}`)).toThrow()
      }),
      config,
    )
  })
})


import { describe, expect, test } from "bun:test"
import {
  addDocuments,
  removeDocument,
  documentsReady,
  MAX_DOCUMENTS_PER_CATEGORY,
} from "./documents"

const pdf = (name: string) =>
  new File(["example"], name, { type: "application/pdf" })

const textFile = (name: string) =>
  new File(["notes"], name, { type: "text/plain" })

let nextId = 0
const createId = () => `document-${++nextId}`

describe("AI-xam document collection", () => {
  test("adds an exam to the correct category", () => {
    const result = addDocuments(
      [],
      [pdf("exam.pdf")],
      "past-exam",
      createId,
    )

    expect(result.errors).toHaveLength(0)
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0]?.category).toBe("past-exam")
  })

  test("keeps exams and course materials separate", () => {
    const exams = addDocuments(
      [],
      [pdf("exam.pdf")],
      "past-exam",
      createId,
    )

    const result = addDocuments(
      exams.documents,
      [textFile("lecture.txt")],
      "course-material",
      createId,
    )

    expect(result.documents).toHaveLength(2)
    expect(documentsReady(result.documents)).toBe(true)
  })

  test("rejects duplicate names within one category", () => {
    const result = addDocuments(
      [],
      [pdf("Exam.pdf"), pdf("exam.PDF")],
      "past-exam",
      createId,
    )

    expect(result.documents).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
  })

  test("allows identical names across categories", () => {
    const first = addDocuments(
      [],
      [pdf("document.pdf")],
      "past-exam",
      createId,
    )

    const second = addDocuments(
      first.documents,
      [pdf("document.pdf")],
      "course-material",
      createId,
    )

    expect(second.documents).toHaveLength(2)
    expect(second.errors).toHaveLength(0)
  })

  test("keeps valid files when another upload is invalid", () => {
    const invalid = new File(["data"], "program.exe")

    const result = addDocuments(
      [],
      [invalid, pdf("exam.pdf")],
      "past-exam",
      createId,
    )

    expect(result.documents).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
  })

  test("enforces the maximum number of documents", () => {
    const files = Array.from(
      { length: MAX_DOCUMENTS_PER_CATEGORY + 1 },
      (_, index) => pdf(`exam-${index}.pdf`),
    )

    const result = addDocuments(
      [],
      files,
      "past-exam",
      createId,
    )

    expect(result.documents).toHaveLength(
      MAX_DOCUMENTS_PER_CATEGORY,
    )
    expect(result.errors).toHaveLength(1)
  })

  test("removes only the selected document", () => {
    const result = addDocuments(
      [],
      [pdf("exam-1.pdf"), pdf("exam-2.pdf")],
      "past-exam",
      createId,
    )

    const remaining = removeDocument(
      result.documents,
      result.documents[0]!.id,
    )

    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.name).toBe("exam-2.pdf")
  })

  test("requires both categories before analysis", () => {
    expect(documentsReady([])).toBe(false)

    const exams = addDocuments(
      [],
      [pdf("exam.pdf")],
      "past-exam",
      createId,
    )

    expect(documentsReady(exams.documents)).toBe(false)

    const complete = addDocuments(
      exams.documents,
      [textFile("notes.txt")],
      "course-material",
      createId,
    )

    expect(documentsReady(complete.documents)).toBe(true)
  })

  test("does not mutate the original collection", () => {
    const original = addDocuments(
      [],
      [pdf("exam.pdf")],
      "past-exam",
      createId,
    ).documents

    const updated = addDocuments(
      original,
      [pdf("second.pdf")],
      "past-exam",
      createId,
    )

    expect(original).toHaveLength(1)
    expect(updated.documents).toHaveLength(2)
  })
})

import { describe, expect, test } from "bun:test"
import { addDocuments } from "../domain/documents"
import type { SelectedDocument } from "../domain/types"
import { reviewSources } from "./source-review"

let counter = 0

function upload(
  existing: SelectedDocument[],
  files: File[],
  category: "past-exam" | "course-material",
) {
  const result = addDocuments(
    existing,
    files,
    category,
    () => `review-${++counter}`,
  )

  expect(result.errors).toHaveLength(0)
  return result.documents
}

const pdf = (name = "exam.pdf") =>
  new File(["%PDF-1.7\nTest fixture"], name)

const notes = (content = "Testing and abstraction") =>
  new File([content], "lecture.txt")

describe("AI-xam source review", () => {
  test("rejects missing document categories", async () => {
    const result = await reviewSources([])

    expect(result.ok).toBe(false)

    if (!result.ok) {
      expect(result.errors[0]).toContain("past exam")
    }
  })

  test("prepares an exam and course notes successfully", async () => {
    const exams = upload([], [pdf()], "past-exam")
    const documents = upload(
      exams,
      [notes()],
      "course-material",
    )

    const result = await reviewSources(documents)

    expect(result.ok).toBe(true)

    if (result.ok) {
      expect(result.prepared).toHaveLength(2)
      expect(result.prepared.some((doc) => doc.kind === "pdf")).toBe(true)
      expect(result.prepared.some((doc) => doc.kind === "text")).toBe(true)
    }
  })

  test("rejects an invalid PDF", async () => {
    const exams = upload(
      [],
      [new File(["Not a PDF"], "invalid.pdf")],
      "past-exam",
    )

    const documents = upload(
      exams,
      [notes()],
      "course-material",
    )

    const result = await reviewSources(documents)

    expect(result.ok).toBe(false)

    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("invalid.pdf")
      expect(result.errors.join(" ")).toContain("PDF header")
    }
  })

  test("rejects unreadable course material", async () => {
    const exams = upload([], [pdf()], "past-exam")
    const documents = upload(
      exams,
      [notes("   \n   ")],
      "course-material",
    )

    const result = await reviewSources(documents)

    expect(result.ok).toBe(false)

    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("readable text")
    }
  })

  test("does not alter the uploaded documents", async () => {
    const exams = upload([], [pdf()], "past-exam")
    const documents = upload(
      exams,
      [notes()],
      "course-material",
    )

    const before = [...documents]

    await reviewSources(documents)

    expect(documents).toEqual(before)
  })
})

import { describe, expect, test } from "bun:test"
import {
  MAX_DOCUMENT_BYTES,
  validateDocument,
} from "./document-validation"

describe("AI-xam document validation", () => {
  test("accepts a valid PDF", () => {
    const file = new File(["example"], "past-exam.pdf")

    expect(validateDocument(file)).toEqual({
      valid: true,
      format: "pdf",
    })
  })

  test("accepts text and Markdown documents", () => {
    const txt = new File(["notes"], "lecture.txt")
    const md = new File(["notes"], "lecture.md")

    expect(validateDocument(txt).valid).toBe(true)
    expect(validateDocument(md).valid).toBe(true)
  })

  test("accepts uppercase file extensions", () => {
    const file = new File(["example"], "exam.PDF")

    expect(validateDocument(file)).toEqual({
      valid: true,
      format: "pdf",
    })
  })

  test("rejects unsupported formats", () => {
    const file = new File(["example"], "exam.exe")

    expect(validateDocument(file).valid).toBe(false)
  })

  test("rejects files without an extension", () => {
    const file = new File(["example"], "exam")

    expect(validateDocument(file).valid).toBe(false)
  })

  test("rejects empty documents", () => {
    const file = new File([], "empty.pdf")

    expect(validateDocument(file).valid).toBe(false)
  })

  test("rejects oversized documents", () => {
    const file = {
      name: "large.pdf",
      size: MAX_DOCUMENT_BYTES + 1,
    }

    expect(validateDocument(file).valid).toBe(false)
  })

  test("accepts documents at the size limit", () => {
    const file = {
      name: "exam.pdf",
      size: MAX_DOCUMENT_BYTES,
    }

    expect(validateDocument(file).valid).toBe(true)
  })

  test("rejects duplicate filenames", () => {
    const file = new File(["example"], "Exam.PDF")

    expect(
      validateDocument(file, ["exam.pdf"]).valid,
    ).toBe(false)
  })
})

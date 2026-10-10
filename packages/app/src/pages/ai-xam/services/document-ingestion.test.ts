import { describe, expect, test } from "bun:test"
import { addDocuments } from "../domain/documents"
import {
  MAX_TEXT_CHARACTERS,
  prepareDocument,
  prepareDocuments,
} from "./document-ingestion"

let id = 0
const nextId = () => `ingestion-${++id}`

function selected(
  name: string,
  contents: BlobPart[],
  category: "past-exam" | "course-material" = "course-material",
) {
  const file = new File(contents, name)

  const result = addDocuments(
    [],
    [file],
    category,
    nextId,
  )

  if (result.documents.length !== 1) {
    throw new Error("Test document setup failed.")
  }

  return result.documents[0]!
}

describe("AI-xam document ingestion", () => {
  test("reads real text-file content", async () => {
    const document = selected(
      "lecture.txt",
      ["Software engineering includes testing."],
    )

    const result = await prepareDocument(document)

    expect(result.kind).toBe("text")

    if (result.kind === "text") {
      expect(result.content).toContain("testing")
      expect(result.category).toBe("course-material")
    }
  })

  test("reads Markdown content", async () => {
    const document = selected(
      "notes.md",
      ["# Testing\n\nUnit tests verify individual units."],
    )

    const result = await prepareDocument(document)

    expect(result.kind).toBe("text")

    if (result.kind === "text") {
      expect(result.content).toContain("# Testing")
      expect(result.format).toBe("md")
    }
  })

  test("normalizes line endings and whitespace", async () => {
    const document = selected(
      "notes.txt",
      ["  First line\r\nSecond line  "],
    )

    const result = await prepareDocument(document)

    if (result.kind !== "text") {
      throw new Error("Expected text document.")
    }

    expect(result.content).toBe("First line\nSecond line")
  })

  test("recognizes a PDF and preserves its file", async () => {
    const document = selected(
      "past-exam.pdf",
      ["%PDF-1.7\nTest fixture"],
      "past-exam",
    )

    const result = await prepareDocument(document)

    expect(result.kind).toBe("pdf")

    if (result.kind === "pdf") {
      expect(result.file).toBe(document.file)
      expect(result.category).toBe("past-exam")
    }
  })

  test("rejects a falsely named PDF", async () => {
    const document = selected(
      "fake.pdf",
      ["This is ordinary text, not a PDF."],
      "past-exam",
    )

    expect(prepareDocument(document)).rejects.toThrow(
      "recognizable PDF header",
    )
  })

  test("rejects whitespace-only text", async () => {
    const document = selected("empty.txt", [" \n \t "])

    expect(prepareDocument(document)).rejects.toThrow(
      "no readable text",
    )
  })

  test("rejects binary data masquerading as text", async () => {
    const document = selected(
      "binary.txt",
      [new Uint8Array([65, 0, 66])],
    )

    expect(prepareDocument(document)).rejects.toThrow(
      "binary data",
    )
  })

  test("rejects invalid UTF-8", async () => {
    const document = selected(
      "invalid.txt",
      [new Uint8Array([0xff, 0xfe, 0x61])],
    )

    expect(prepareDocument(document)).rejects.toThrow(
      "valid UTF-8",
    )
  })

  test("rejects text exceeding the content limit", async () => {
    const document = selected(
      "large.txt",
      ["A".repeat(MAX_TEXT_CHARACTERS + 1)],
    )

    expect(prepareDocument(document)).rejects.toThrow(
      "character limit",
    )
  })

  test("processes valid documents even when another fails", async () => {
    const valid = selected(
      "valid.txt",
      ["Integration testing checks components."],
    )

    const invalid = selected(
      "invalid.pdf",
      ["Not a PDF"],
      "past-exam",
    )

    const result = await prepareDocuments([valid, invalid])

    expect(result.prepared).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.prepared[0]?.name).toBe("valid.txt")
    expect(result.errors[0]?.name).toBe("invalid.pdf")
  })

  test("returns empty results when no documents exist", async () => {
    const result = await prepareDocuments([])

    expect(result.prepared).toEqual([])
    expect(result.errors).toEqual([])
  })
})

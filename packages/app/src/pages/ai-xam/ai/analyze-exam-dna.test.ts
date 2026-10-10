import { describe, expect, test } from "bun:test"
import {
  analyzeExamDNA,
  type ExamDNATransport,
} from "./analyze-exam-dna"
import { pdfToDataURL } from "./opencode-exam-dna-client"
import type { PreparedDocument } from "../services/document-ingestion"

const exam: PreparedDocument = {
  kind: "text",
  id: "exam-1",
  name: "past-exam.txt",
  category: "past-exam",
  format: "txt",
  content: "Question 1: Explain unit testing.",
}

const notes: PreparedDocument = {
  kind: "text",
  id: "notes-1",
  name: "lecture.txt",
  category: "course-material",
  format: "txt",
  content: "Unit testing verifies individual components.",
}

const validResponse = JSON.stringify({
  analyzedExamIds: ["exam-1"],
  typicalQuestionCount: 1,
  typicalDurationMinutes: null,
  difficulty: "unknown",
  questionTypes: [{
    kind: "short-answer",
    observedCount: 1,
    evidence: [{
      documentId: "exam-1",
      location: "Question 1",
      description: "Written conceptual explanation.",
    }],
  }],
  topics: [{
    name: "Unit Testing",
    observedCount: 1,
    evidence: [{
      documentId: "exam-1",
      location: "Question 1",
      description: "Asks about unit testing.",
    }],
  }],
  observations: ["Conceptual question."],
  limitations: ["Exam duration unavailable."],
})

describe("AI-xam analysis orchestration", () => {
  test("returns validated Exam DNA", async () => {
    const transport: ExamDNATransport = {
      request: async ({ prompt }) => {
        expect(prompt).toContain("Unit testing")
        return validResponse
      },
    }

    const result = await analyzeExamDNA(
      [exam, notes],
      transport,
    )

    expect(result.topics[0]?.name).toBe("Unit Testing")
    expect(result.typicalQuestionCount).toBe(1)
  })

  test("rejects insufficient inputs before contacting the model", async () => {
    let called = false

    const transport: ExamDNATransport = {
      request: async () => {
        called = true
        return validResponse
      },
    }

    expect(
      analyzeExamDNA([exam], transport),
    ).rejects.toThrow("requires")

    expect(called).toBe(false)
  })

  test("rejects malformed AI output", async () => {
    const transport: ExamDNATransport = {
      request: async () => "not valid JSON",
    }

    expect(
      analyzeExamDNA([exam, notes], transport),
    ).rejects.toThrow("not valid JSON")
  })

  test("passes PDF attachments to the transport", async () => {
    const pdf: PreparedDocument = {
      kind: "pdf",
      id: "pdf-1",
      name: "reference.pdf",
      category: "course-material",
      format: "pdf",
      file: new File(
        ["%PDF-1.7\nFixture"],
        "reference.pdf",
        { type: "application/pdf" },
      ),
    }

    const transport: ExamDNATransport = {
      request: async ({ pdfs }) => {
        expect(pdfs).toHaveLength(1)
        expect(pdfs[0]?.name).toBe("reference.pdf")
        return validResponse
      },
    }

    const result = await analyzeExamDNA(
      [exam, pdf],
      transport,
    )

    expect(result.analyzedExamIds).toEqual(["exam-1"])
  })

  test("preserves model connection failures", async () => {
    const transport: ExamDNATransport = {
      request: async () => {
        throw new Error("Provider unavailable")
      },
    }

    expect(
      analyzeExamDNA([exam, notes], transport),
    ).rejects.toThrow("Provider unavailable")
  })
})

describe("AI-xam PDF attachment encoding", () => {
  test("encodes binary PDF bytes as a data URL", async () => {
    const file = new File(
      [new Uint8Array([37, 80, 68, 70, 45])],
      "sample.pdf",
    )

    const result = await pdfToDataURL(file)

    expect(result).toStartWith("data:application/pdf;base64,")
    expect(atob(result.split(",")[1]!)).toBe("%PDF-")
  })
})

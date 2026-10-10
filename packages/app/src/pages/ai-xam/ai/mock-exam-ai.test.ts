import { describe, expect, test } from "bun:test"
import { generateMockExam, gradeMockExam } from "./mock-exam-ai"
import { examJSON, fixtureDNA, settings } from "../domain/mock-exam.fixtures"
import type { PreparedDocument } from "../services/document-ingestion"

const documents: PreparedDocument[] = [
  { kind: "text", id: "exam-1", category: "past-exam", format: "txt", name: "past.txt", content: "1. What is testing?" },
  { kind: "text", id: "notes-1", category: "course-material", format: "txt", name: "notes.txt", content: "Automated tests detect regressions." },
]

describe("mock exam AI orchestration", () => {
  test("sends grounded text, generates an exam, and grades without the answer key in the UI", async () => {
    let received = ""
    const transport = { request: async ({ prompt }: { prompt: string }) => { received = prompt; return examJSON } }
    const exam = await generateMockExam({ dna: fixtureDNA, documents, settings, transport })
    expect(received).toContain("Automated tests detect regressions")
    expect(exam.questions).toHaveLength(2)
    const gradingTransport = { request: async ({ prompt }: { prompt: string }) => {
      expect(prompt).toContain('"studentAnswer":"A test of code"')
      return '{"grades":[{"questionId":"q1","earnedPoints":5,"feedback":"Correct"},{"questionId":"q2","earnedPoints":0,"feedback":"No answer"}]}'
    } }
    const grades = await gradeMockExam({ exam, answers: { q1: "A test of code" }, transport: gradingTransport })
    expect(grades.grades).toHaveLength(2)
  })
  test("rejects hallucinated topics, handles AI network errors and excludes old prompts", async () => {
    await expect(generateMockExam({
      dna: fixtureDNA, documents, settings,
      retakeTopics: ["Nonexistent"], transport: { request: async () => examJSON },
    })).rejects.toThrow("topic")
    await expect(generateMockExam({
      dna: fixtureDNA, documents, settings, transport: { request: async () => { throw new Error("Provider unavailable") } },
    })).rejects.toThrow("Provider unavailable")
    await expect(generateMockExam({
      dna: fixtureDNA, documents, settings, previousQuestions: ["How do unit tests work?"],
      transport: { request: async () => examJSON },
    })).rejects.toThrow("repeated question")
  })
})

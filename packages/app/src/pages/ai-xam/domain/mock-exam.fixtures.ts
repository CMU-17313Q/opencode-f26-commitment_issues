import type { ExamDNA } from "./exam-dna"
import type { ExamSettings } from "./mock-exam"

export const fixtureDNA: ExamDNA = {
  analyzedExamIds: ["exam-1"], typicalQuestionCount: 2, typicalDurationMinutes: 30,
  difficulty: "moderate", questionTypes: [{ kind: "short-answer", observedCount: 2,
    evidence: [{ documentId: "exam-1", location: "Q1", description: "Written answer" }] }],
  topics: [{ name: "Testing", observedCount: 2,
    evidence: [{ documentId: "exam-1", location: "Q1", description: "Unit tests" }] }],
  observations: [], limitations: [],
}
export const settings: ExamSettings = { difficulty: "moderate", durationMinutes: 30, questionCount: 2, formats: ["short-answer"] }
export const examJSON = JSON.stringify({ title: "Practice", questions: [
  { id: "q1", kind: "short-answer", topic: "Testing", points: 5, prompt: "How do unit tests work?", choices: [], referenceAnswer: "Test individual units", rubric: "5 points for isolation" },
  { id: "q2", kind: "short-answer", topic: "Testing", points: 5, prompt: "Why run automated tests?", choices: [], referenceAnswer: "Detect regressions", rubric: "5 points for regressions" },
] })

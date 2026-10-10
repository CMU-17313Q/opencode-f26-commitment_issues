export const QUESTION_FORMATS = [
  "multiple-choice",
  "short-answer",
  "essay",
  "problem-solving",
  "coding",
  "other",
] as const

export type QuestionFormat = (typeof QUESTION_FORMATS)[number]

export type ExamEvidence = {
  documentId: string
  location: string
  description: string
}

export type ExamDNA = {
  analyzedExamIds: string[]

  typicalQuestionCount: number | null
  typicalDurationMinutes: number | null

  difficulty: "easy" | "moderate" | "hard" | "mixed" | "unknown"

  questionTypes: {
    kind: QuestionFormat
    observedCount: number | null
    evidence: ExamEvidence[]
  }[]

  topics: {
    name: string
    observedCount: number | null
    evidence: ExamEvidence[]
  }[]

  observations: string[]
  limitations: string[]
}

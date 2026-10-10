import { QUESTION_FORMATS, type ExamDNA, type QuestionFormat } from "./exam-dna"

export type ExamDifficulty = "easy" | "moderate" | "hard" | "mixed"
export type ExamSettings = {
  difficulty: ExamDifficulty
  questionCount: number
  formats: QuestionFormat[]
  durationMinutes: number
}
export type MockQuestion = {
  id: string
  kind: QuestionFormat
  topic: string
  points: number
  prompt: string
  choices: string[]
  // Kept in app state but not rendered until the submitted-results view.
  referenceAnswer: string
  rubric: string
}
export type MockExam = { title: string; questions: MockQuestion[] }
export type QuestionGrade = { questionId: string; earnedPoints: number; feedback: string }
export type ExamGrade = { grades: QuestionGrade[] }
export type TopicScore = { topic: string; earned: number; possible: number; percentage: number }
export type ExamResult = {
  exam: MockExam
  answers: Record<string, string>
  grade: ExamGrade
  totalEarned: number
  totalPossible: number
  percentage: number
  topics: TopicScore[]
}

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length < 10000
const formats = new Set<string>(QUESTION_FORMATS)

export function parseModelJSON(response: string): unknown {
  const cleaned = response.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try { return JSON.parse(cleaned) } catch { throw new Error("AI returned invalid JSON. Please try again.") }
}

export function validateSettings(settings: ExamSettings): void {
  if (!Number.isInteger(settings.questionCount) || settings.questionCount < 1 || settings.questionCount > 20)
    throw new Error("Choose between 1 and 20 questions.")
  if (!Number.isInteger(settings.durationMinutes) || settings.durationMinutes < 5 || settings.durationMinutes > 180)
    throw new Error("Choose a time limit between 5 and 180 minutes.")
  if (!["easy", "moderate", "hard", "mixed"].includes(settings.difficulty))
    throw new Error("Invalid difficulty selection.")
  if (!settings.formats.length || settings.formats.some((kind) => !formats.has(kind)))
    throw new Error("Choose at least one question format.")
}

export function parseMockExam(response: string, settings: ExamSettings, dna: ExamDNA, excluded: readonly string[] = []): MockExam {
  const input = parseModelJSON(response)
  if (!record(input) || !text(input.title) || !Array.isArray(input.questions) || input.questions.length !== settings.questionCount)
    throw new Error("AI generated an incomplete mock exam. Please retry.")
  const ids = new Set<string>()
  const allowedTopics = new Set(dna.topics.map((topic) => topic.name))
  const prior = new Set(excluded.map((x) => x.toLowerCase().trim()))
  const questions: MockQuestion[] = input.questions.map((q: unknown) => {
    if (!record(q) || !text(q.id) || ids.has(q.id) || !text(q.prompt) || prior.has(q.prompt.toLowerCase().trim()) ||
        !text(q.topic) || !allowedTopics.has(q.topic) || !settings.formats.includes(q.kind as QuestionFormat) ||
        !Number.isInteger(q.points) || (q.points as number) < 1 || (q.points as number) > 20 ||
        !text(q.referenceAnswer) || !text(q.rubric) || !Array.isArray(q.choices) ||
        !q.choices.every(text) || q.choices.length > 8 ||
        (q.kind === "multiple-choice" && q.choices.length !== 4) ||
        (q.kind !== "multiple-choice" && q.choices.length !== 0)) {
      throw new Error("AI generated an invalid or repeated question. Please retry.")
    }
    ids.add(q.id)
    return { id: q.id, kind: q.kind as QuestionFormat, topic: q.topic, points: q.points as number,
      prompt: q.prompt, choices: q.choices, referenceAnswer: q.referenceAnswer, rubric: q.rubric }
  })
  if (new Set(questions.map((q) => q.prompt.toLowerCase().trim())).size !== questions.length)
    throw new Error("AI generated duplicate questions. Please retry.")
  return { title: input.title, questions }
}

export function parseGrade(response: string, exam: MockExam): ExamGrade {
  const input = parseModelJSON(response)
  if (!record(input) || !Array.isArray(input.grades) || input.grades.length !== exam.questions.length)
    throw new Error("AI grading was incomplete. Your answers have been preserved.")
  const byId = new Map(exam.questions.map((q) => [q.id, q]))
  const seen = new Set<string>()
  const grades: QuestionGrade[] = input.grades.map((g: unknown) => {
    if (!record(g) || !text(g.questionId) || !byId.has(g.questionId) || seen.has(g.questionId) ||
        !Number.isFinite(g.earnedPoints) || typeof g.earnedPoints !== "number" ||
        g.earnedPoints < 0 || g.earnedPoints > byId.get(g.questionId)!.points || !text(g.feedback))
      throw new Error("AI returned invalid grades. Your answers have been preserved.")
    seen.add(g.questionId)
    return { questionId: g.questionId, earnedPoints: g.earnedPoints, feedback: g.feedback }
  })
  return { grades }
}

export function calculateResult(exam: MockExam, answers: Record<string, string>, grade: ExamGrade): ExamResult {
  const lookup = new Map(grade.grades.map((g) => [g.questionId, g]))
  if (lookup.size !== exam.questions.length) throw new Error("Some grades are missing.")
  const totals = new Map<string, { earned: number; possible: number }>()
  let totalEarned = 0, totalPossible = 0
  for (const q of exam.questions) {
    const g = lookup.get(q.id)
    if (!g || !Number.isFinite(g.earnedPoints) || g.earnedPoints < 0 || g.earnedPoints > q.points)
      throw new Error("Invalid grade score.")
    totalEarned += g.earnedPoints
    totalPossible += q.points
    const group = totals.get(q.topic) ?? { earned: 0, possible: 0 }
    group.earned += g.earnedPoints
    group.possible += q.points
    totals.set(q.topic, group)
  }
  return {
    exam, answers: { ...answers }, grade, totalEarned, totalPossible,
    percentage: Math.round((totalEarned / totalPossible) * 100),
    topics: [...totals.entries()].map(([topic, value]) => ({ topic, ...value, percentage: Math.round(100 * value.earned / value.possible) })),
  }
}

export function weakTopics(result: ExamResult): string[] {
  return result.topics.filter((topic) => topic.percentage < 70).map((topic) => topic.topic)
}

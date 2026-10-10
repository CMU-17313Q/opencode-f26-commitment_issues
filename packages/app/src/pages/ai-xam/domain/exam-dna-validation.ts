import {
  QUESTION_FORMATS,
  type ExamDNA,
} from "./exam-dna"

export type DNAValidationResult =
  | { ok: true; dna: ExamDNA }
  | { ok: false; errors: string[] }

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length > 0
}

function validCount(value: unknown, max = 1000): boolean {
  return value === null ||
    (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= max
    )
}

function validStrings(value: unknown): boolean {
  return Array.isArray(value) &&
    value.length <= 20 &&
    value.every(isText)
}

function validEvidence(
  value: unknown,
  sourceIds: Set<string>,
): boolean {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) =>
      isRecord(item) &&
      isText(item.documentId) &&
      sourceIds.has(item.documentId) &&
      isText(item.location) &&
      isText(item.description)
    )
}

function validPatterns(
  value: unknown,
  field: "kind" | "name",
  sourceIds: Set<string>,
): boolean {
  if (!Array.isArray(value) ||
      value.length === 0 ||
      value.length > 30) return false

  const seen = new Set<string>()
  const formats = new Set<string>(QUESTION_FORMATS)

  return value.every((item) => {
    if (!isRecord(item)) return false

    const label = item[field]
    if (!isText(label)) return false

    const normalized = label.toLowerCase().trim()
    if (seen.has(normalized)) return false
    seen.add(normalized)

    if (field === "kind" && !formats.has(label)) {
      return false
    }

    return validCount(item.observedCount) &&
      validEvidence(item.evidence, sourceIds)
  })
}

export function validateExamDNA(
  input: unknown,
  allowedExamIds: readonly string[],
): DNAValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: ["Exam DNA must be an object."],
    }
  }

  const errors: string[] = []
  const allowed = new Set(allowedExamIds)
  const ids = input.analyzedExamIds

  const validIds =
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.every(
      (id: unknown) =>
        typeof id === "string" && allowed.has(id),
    ) &&
    new Set(ids).size === ids.length

  if (!validIds) {
    errors.push("Invalid analyzed exam identifiers.")
  }

  const sourceIds = new Set<string>(
    validIds ? (ids as string[]) : [],
  )

  if (!validCount(input.typicalQuestionCount, 200)) {
    errors.push("Invalid typical question count.")
  }

  if (!validCount(input.typicalDurationMinutes, 600)) {
    errors.push("Invalid exam duration.")
  }

  if (
    !["easy", "moderate", "hard", "mixed", "unknown"]
      .includes(String(input.difficulty))
  ) {
    errors.push("Invalid difficulty classification.")
  }

  if (!validPatterns(input.questionTypes, "kind", sourceIds)) {
    errors.push("Invalid question-type evidence.")
  }

  if (!validPatterns(input.topics, "name", sourceIds)) {
    errors.push("Invalid topic evidence.")
  }

  if (!validStrings(input.observations)) {
    errors.push("Invalid exam observations.")
  }

  if (!validStrings(input.limitations)) {
    errors.push("Invalid analysis limitations.")
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    dna: input as ExamDNA,
  }
}

import type { ExamDNA } from "../domain/exam-dna"
import { validateExamDNA } from "../domain/exam-dna-validation"

export function parseExamDNAResponse(
  response: string,
  allowedExamIds: readonly string[],
): ExamDNA {
  const text = response.trim()

  if (!text) {
    throw new Error("The AI returned an empty response.")
  }

  // Tolerate a single JSON code fence if the model adds one.
  const match = /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i.exec(text)
  const candidate = match ? match[1] : text

  let parsed: unknown

  try {
    parsed = JSON.parse(candidate)
  } catch {
    throw new Error("The AI response is not valid JSON.")
  }

  if (
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "error" in parsed &&
    typeof parsed.error === "string"
  ) {
    throw new Error(`Exam DNA analysis unavailable: ${parsed.error}`)
  }

  const result = validateExamDNA(parsed, allowedExamIds)

  if (!result.ok) {
    throw new Error(
      `Invalid Exam DNA response: ${result.errors.join("; ")}`,
    )
  }

  return result.dna
}

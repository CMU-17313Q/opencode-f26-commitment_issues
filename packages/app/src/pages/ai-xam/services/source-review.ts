import { documentsReady } from "../domain/documents"
import type { SelectedDocument } from "../domain/types"
import {
  prepareDocuments,
  type PreparedDocument,
} from "./document-ingestion"

export type SourceReviewResult =
  | { ok: true; prepared: PreparedDocument[] }
  | { ok: false; errors: string[] }

export async function reviewSources(
  documents: readonly SelectedDocument[],
): Promise<SourceReviewResult> {
  if (!documentsReady(documents)) {
    return {
      ok: false,
      errors: [
        "Add at least one past exam and one course-material document.",
      ],
    }
  }

  const result = await prepareDocuments(documents)

  // Do not silently discard invalid documents.
  // Require the student to correct or remove them.
  if (result.errors.length > 0) {
    return {
      ok: false,
      errors: result.errors.map(
        (error) => `${error.name}: ${error.message}`,
      ),
    }
  }

  const hasExam = result.prepared.some(
    (document) => document.category === "past-exam",
  )
  const hasMaterials = result.prepared.some(
    (document) => document.category === "course-material",
  )

  if (!hasExam || !hasMaterials) {
    return {
      ok: false,
      errors: [
        "Both document categories must contain usable sources.",
      ],
    }
  }

  return {
    ok: true,
    prepared: result.prepared,
  }
}

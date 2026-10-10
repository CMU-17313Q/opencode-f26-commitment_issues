import type { DocumentCategory, SelectedDocument } from "./types"
import { validateDocument } from "./document-validation"

export const MAX_DOCUMENTS_PER_CATEGORY = 6

export type AddDocumentsResult = {
  documents: SelectedDocument[]
  errors: string[]
}

export function addDocuments(
  existing: readonly SelectedDocument[],
  incoming: readonly File[],
  category: DocumentCategory,
  createId: () => string = () => crypto.randomUUID(),
): AddDocumentsResult {
  const documents = [...existing]
  const errors: string[] = []

  for (const file of incoming) {
    const categoryDocuments = documents.filter(
      (document) => document.category === category,
    )

    const validation = validateDocument(
      file,
      categoryDocuments.map((document) => document.name),
    )

    if (!validation.valid) {
      errors.push(`${file.name}: ${validation.error}`)
      continue
    }

    if (categoryDocuments.length >= MAX_DOCUMENTS_PER_CATEGORY) {
      errors.push(
        `${file.name}: Maximum ${MAX_DOCUMENTS_PER_CATEGORY} documents per category.`,
      )
      continue
    }

    documents.push({
      id: createId(),
      category,
      name: file.name,
      size: file.size,
      format: validation.format,
      file,
    })
  }

  return { documents, errors }
}

export function removeDocument(
  documents: readonly SelectedDocument[],
  id: string,
): SelectedDocument[] {
  return documents.filter((document) => document.id !== id)
}

export function documentsReady(
  documents: readonly SelectedDocument[],
): boolean {
  const hasPastExam = documents.some(
    (document) => document.category === "past-exam",
  )
  const hasCourseMaterial = documents.some(
    (document) => document.category === "course-material",
  )

  return hasPastExam && hasCourseMaterial
}

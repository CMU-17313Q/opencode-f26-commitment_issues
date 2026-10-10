import type { SelectedDocument } from "../domain/types"
import { validateDocument } from "../domain/document-validation"

export const MAX_TEXT_CHARACTERS = 120_000

export type PreparedDocument =
  | {
      kind: "text"
      id: string
      name: string
      category: SelectedDocument["category"]
      format: "txt" | "md"
      content: string
    }
  | {
      kind: "pdf"
      id: string
      name: string
      category: SelectedDocument["category"]
      format: "pdf"
      file: File
    }

export type DocumentProcessingError = {
  id: string
  name: string
  message: string
}

export type DocumentProcessingResult = {
  prepared: PreparedDocument[]
  errors: DocumentProcessingError[]
}

function readError(error: unknown): string {
  if (error instanceof Error) return error.message
  return "The document could not be read."
}

export async function prepareDocument(
  document: SelectedDocument,
): Promise<PreparedDocument> {
  const validation = validateDocument(document.file)

  if (!validation.valid) {
    throw new Error(validation.error)
  }

  if (validation.format !== document.format) {
    throw new Error("Document format does not match the uploaded file.")
  }

  if (document.format === "pdf") {
    const buffer = await document.file.slice(0, 1024).arrayBuffer()
    const header = new TextDecoder("latin1").decode(buffer)

    if (!/%PDF-\d\.\d/.test(header)) {
      throw new Error(
        "This file does not have a recognizable PDF header.",
      )
    }

    // Retain the real File for the OpenCode attachment pipeline.
    return {
      kind: "pdf",
      id: document.id,
      name: document.name,
      category: document.category,
      format: "pdf",
      file: document.file,
    }
  }

  const buffer = await document.file.arrayBuffer()
  let text: string

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer)
  } catch {
    throw new Error("The document is not valid UTF-8 text.")
  }

  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
    throw new Error("The document appears to contain binary data.")
  }

  const content = text.replace(/\r\n/g, "\n").trim()

  if (!content) {
    throw new Error("The document contains no readable text.")
  }

  if (content.length > MAX_TEXT_CHARACTERS) {
    throw new Error(
      `Text exceeds the ${MAX_TEXT_CHARACTERS.toLocaleString("en-US")} character limit.`,
    )
  }

  return {
    kind: "text",
    id: document.id,
    name: document.name,
    category: document.category,
    format: document.format,
    content,
  }
}

export async function prepareDocuments(
  documents: readonly SelectedDocument[],
): Promise<DocumentProcessingResult> {
  const prepared: PreparedDocument[] = []
  const errors: DocumentProcessingError[] = []

  for (const document of documents) {
    try {
      prepared.push(await prepareDocument(document))
    } catch (error) {
      errors.push({
        id: document.id,
        name: document.name,
        message: readError(error),
      })
    }
  }

  return { prepared, errors }
}

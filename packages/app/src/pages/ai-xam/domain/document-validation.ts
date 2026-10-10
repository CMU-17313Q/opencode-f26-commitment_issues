import type { DocumentFormat } from "./types"

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

export type DocumentValidationResult =
  | { valid: true; format: DocumentFormat }
  | { valid: false; error: string }

const supportedFormats = new Set<DocumentFormat>([
  "pdf",
  "txt",
  "md",
])

export function validateDocument(
  file: Pick<File, "name" | "size">,
  existingNames: readonly string[] = [],
): DocumentValidationResult {
  const name = file.name.trim()
  const dot = name.lastIndexOf(".")

  if (dot <= 0 || dot === name.length - 1) {
    return {
      valid: false,
      error: "The file must have a supported extension.",
    }
  }

  const extension = name.slice(dot + 1).toLowerCase()

  if (!supportedFormats.has(extension as DocumentFormat)) {
    return {
      valid: false,
      error: "Unsupported format. Upload PDF, TXT, or MD files.",
    }
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return {
      valid: false,
      error: "The file is empty or invalid.",
    }
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return {
      valid: false,
      error: "The file exceeds the 10 MB limit.",
    }
  }

  if (
    existingNames.some(
      (existing) => existing.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    return {
      valid: false,
      error: "This document has already been added.",
    }
  }

  return {
    valid: true,
    format: extension as DocumentFormat,
  }
}

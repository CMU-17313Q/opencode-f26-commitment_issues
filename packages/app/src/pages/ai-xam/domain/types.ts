export type DocumentCategory = "past-exam" | "course-material"

export type DocumentFormat = "pdf" | "txt" | "md"

export type SelectedDocument = {
  id: string
  category: DocumentCategory
  name: string
  format: DocumentFormat
  size: number
  file: File
}

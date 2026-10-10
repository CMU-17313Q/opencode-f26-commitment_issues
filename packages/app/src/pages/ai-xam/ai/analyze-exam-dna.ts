import type { ExamDNA } from "../domain/exam-dna"
import type { PreparedDocument } from "../services/document-ingestion"
import { buildExamDNAPrompt } from "./exam-dna-prompt"
import { parseExamDNAResponse } from "./exam-dna-response"

export type PDFSource = Extract<PreparedDocument, { kind: "pdf" }>

export type ExamDNATransport = {
  request(input: {
    prompt: string
    pdfs: PDFSource[]
  }): Promise<string>
}

export async function analyzeExamDNA(
  documents: readonly PreparedDocument[],
  transport: ExamDNATransport,
): Promise<ExamDNA> {
  // Validate source categories before contacting the AI model.
  const prompt = buildExamDNAPrompt(documents)

  const examIds = documents
    .filter((doc) => doc.category === "past-exam")
    .map((doc) => doc.id)

  const pdfs = documents.filter(
    (doc): doc is PDFSource => doc.kind === "pdf",
  )

  const response = await transport.request({ prompt, pdfs })

  // Never trust model output without validating it.
  return parseExamDNAResponse(response, examIds)
}

import type { OpencodeClient } from "@opencode-ai/sdk"
import type { ExamDNATransport, PDFSource } from "./analyze-exam-dna"

const ENCODING_CHUNK_SIZE = 8192

export async function pdfToDataURL(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const chunks: string[] = []

  for (let i = 0; i < bytes.length; i += ENCODING_CHUNK_SIZE) {
    chunks.push(
      String.fromCharCode(
        ...bytes.subarray(i, i + ENCODING_CHUNK_SIZE),
      ),
    )
  }

  return `data:application/pdf;base64,${btoa(chunks.join(""))}`
}

export function createOpenCodeExamDNATransport(
  client: OpencodeClient,
): ExamDNATransport {
  return {
    async request(input: { prompt: string; pdfs: PDFSource[] }) {
      // Keep the analysis separate from the student's coding session.
      const created = await client.session.create()

      const sessionID = created.data?.id

      if (!sessionID) {
        throw new Error(
          "Could not create an OpenCode analysis session.",
        )
      }

      const pdfParts = await Promise.all(
        input.pdfs.map(async (pdf) => ({
          type: "file" as const,
          mime: "application/pdf",
          filename: pdf.name,
          url: await pdfToDataURL(pdf.file),
        })),
      )

      const response = await client.session.prompt({
        path: { id: sessionID },
        body: {
          parts: [
            {
              type: "text",
              text: input.prompt,
            },
            ...pdfParts,
          ],
        },
      })

      if (!response.data) {
        throw new Error(
          "OpenCode did not return a successful AI response. " +
          "Check your configured model and server connection.",
        )
      }

      const text = response.data.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim()

      if (!text) {
        throw new Error(
          "The model returned no readable Exam DNA analysis.",
        )
      }

      return text
    },
  }
}

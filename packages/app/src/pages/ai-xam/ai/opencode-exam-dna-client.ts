import type { OpencodeClient } from "@opencode-ai/sdk/client"
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
  selectedModel?: {
    providerID: string
    modelID: string
  },
): ExamDNATransport {
  return {
    async request(input: { prompt: string; pdfs: PDFSource[] }) {
      // Keep the analysis separate from the student's coding session.
        const availableTools = await client.tool.ids()

        if (
        availableTools.error ||
        !Array.isArray(availableTools.data)
        ) {
        throw new Error(
            "Could not verify OpenCode's available tools. Analysis was not started.",
        )
        }

        const disabledTools = Object.fromEntries(
        [
            ...availableTools.data,
            "list_mcp_resources",
            "list_mcp_resource_templates",
            "read_mcp_resource",
        ].map((id) => [id, false]),
        )

        const created = await client.session.create({
        body: {
            title: "AI-xam — Exam DNA Analysis",
        },
        })


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
          agent: "build",
          ...(selectedModel ? { model: selectedModel } : {}),
          tools: disabledTools,
          parts: [
            {
              type: "text",
              text: input.prompt,
            },
            ...pdfParts,
          ],
        },
        signal: AbortSignal.timeout(90_000),
      })
      if (response.error) {
        throw new Error(
          `OpenCode request failed: ${JSON.stringify(response.error)}`,
        )
      }

      if (!response.data) {
        throw new Error("OpenCode returned no response data.")
      }

      console.log("AI-xam response diagnostics:", {
        sessionID,
        provider: response.data.info.providerID,
        model: response.data.info.modelID,
        finish: response.data.info.finish,
        error: response.data.info.error,
        partTypes: response.data.parts.map((part) => part.type),
      })

      if (response.data.info.error) {
        throw new Error(
          `OpenCode model error: ${response.data.info.error.name}: ` +
          JSON.stringify(response.data.info.error.data),
        )
      }

      console.log("AI-xam generation details:", {
        tokens: response.data.info.tokens,
        steps: response.data.parts
          .filter((part) => part.type === "step-finish")
          .map((part) => ({
            reason: part.reason,
            tokens: part.tokens,
          })),
      })
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

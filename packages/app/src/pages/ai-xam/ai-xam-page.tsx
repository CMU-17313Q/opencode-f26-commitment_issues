import { For, Show, createSignal } from "solid-js"
import { createOpencodeClient } from "@opencode-ai/sdk/client"
import { UploadStep } from "./components/upload-step"
import { ExamDNADashboard } from "./components/exam-dna-dashboard"
import { MockExamFlow } from "./components/mock-exam-flow"
import { reviewSources } from "./services/source-review"
import { analyzeExamDNA } from "./ai/analyze-exam-dna"
import { createOpenCodeExamDNATransport } from "./ai/opencode-exam-dna-client"
import type { SelectedDocument } from "./domain/types"
import type { PreparedDocument } from "./services/document-ingestion"
import type { ExamDNA } from "./domain/exam-dna"
import "./ai-xam.css"

type AIxamStage =
  | "upload"
  | "processing"
  | "review"
  | "analyzing"
  | "dashboard"
  | "mock-exam"

type AIxamPageProps = {
  serverURL?: string
  model?: { providerID: string; modelID: string }
}

export default function AIxamPage(props: AIxamPageProps) {
  const [documents, setDocuments] =
    createSignal<SelectedDocument[]>([])

  const [prepared, setPrepared] =
    createSignal<PreparedDocument[]>([])

  const [stage, setStage] =
    createSignal<AIxamStage>("upload")

  const [errors, setErrors] =
    createSignal<string[]>([])

  const [dna, setDNA] =
    createSignal<ExamDNA | undefined>()

  // Credentials remain on the OpenCode server, never in the browser.
  const examTransport = (serverURL = props.serverURL ?? "http://127.0.0.1:4096") =>
    createOpenCodeExamDNATransport(createOpencodeClient({ baseUrl: serverURL }),
      props.model ?? { providerID: "anthropic", modelID: "claude-haiku-5-5" })

  const handleDocumentsChange = (next: SelectedDocument[]) => {
    setDocuments(next)
    setPrepared([])
    setDNA(undefined)
    setErrors([])
  }

  const handleReview = async () => {
    if (stage() !== "upload") return

    setStage("processing")
    setErrors([])
    setPrepared([])
    setDNA(undefined)

    try {
      const result = await reviewSources(documents())

      if (!result.ok) {
        setErrors(result.errors)
        setStage("upload")
        return
      }

      setPrepared(result.prepared)
      setStage("review")
    } catch (error) {
      setErrors([
        error instanceof Error
          ? error.message
          : "Something went wrong while reading your documents.",
      ])
      setStage("upload")
    }
  }

  const handleAnalyze = async () => {
    if (stage() !== "review" || prepared().length === 0) {
      return
    }

    setErrors([])
    setDNA(undefined)
    setStage("analyzing")

    try {
      // Local development fallback for the standalone preview.
      // The integrated OpenCode route will supply its active
      // server URL through props.
      const serverURL =
        props.serverURL ?? "http://127.0.0.1:4096"

      const transport = examTransport(serverURL)

      const result = await analyzeExamDNA(
        prepared(),
        transport,
      )

      setDNA(result)
      setStage("dashboard")
    } catch (error) {
      console.error("AI-xam analysis failed:", error)

      setErrors([
        error instanceof Error
          ? error.message
          : "Unable to analyze your documents. Please try again.",
      ])

      // Keep prepared sources so the student can retry.
      setStage("review")
    }
  }

  return (
    <main class="ai-xam-page">
      <div class="ai-xam-container">
        <header class="ai-xam-header">
          <div class="ai-xam-brand">
            <span class="ai-xam-brand-icon">
              A<span>I</span>
            </span>
            <div>
              <h1>AI-xam</h1>
            </div>
          </div>

          <span class="ai-xam-version">
            Learning Companion
          </span>
        </header>

        <Show when={errors().length > 0}>
          <div class="ai-xam-errors" role="alert">
            <strong>AI-xam encountered a problem:</strong>
            <ul>
              <For each={errors()}>
                {(error) => <li>{error}</li>}
              </For>
            </ul>
            <p>
              You can review your sources and try again.
            </p>
          </div>
        </Show>

        <Show when={stage() === "upload"}>
          <UploadStep
            documents={documents()}
            onChange={handleDocumentsChange}
            onContinue={() => void handleReview()}
          />
        </Show>

        <Show when={stage() === "processing"}>
          <section
            class="ai-xam-processing"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              class="ai-xam-spinner"
              aria-hidden="true"
            />

            <span class="ai-xam-eyebrow">
              PREPARING SOURCES
            </span>

            <h2>Checking your documents...</h2>

            <p>
              Reading text files and validating PDF
              attachments. No AI request has been sent yet.
            </p>
          </section>
        </Show>

        <Show when={stage() === "review"}>
          <section class="ai-xam-review">
            <span class="ai-xam-eyebrow">
              STEP 02 / PREPARED SOURCES
            </span>

            <h2>Your documents are ready.</h2>

            <p>
              AI-xam successfully prepared{" "}
              {prepared().length} documents.
              Review them before generating Exam DNA.
            </p>

            <div class="ai-xam-prepared-list">
              <For each={prepared()}>
                {(document) => (
                  <div class="ai-xam-prepared-item">
                    <span class="ai-xam-prepared-format">
                      {document.format.toUpperCase()}
                    </span>

                    <div class="ai-xam-prepared-details">
                      <strong>{document.name}</strong>

                      <span>
                        {document.category === "past-exam"
                          ? "Past Exam"
                          : "Course Material"}
                      </span>
                    </div>

                    <span class="ai-xam-prepared-status">
                      {document.kind === "text"
                        ? `${document.content.length.toLocaleString()} characters read`
                        : "PDF header verified"}
                    </span>
                  </div>
                )}
              </For>
            </div>

            <div class="ai-xam-review-footer">
              <button
                type="button"
                class="ai-xam-primary-button"
                onClick={() => {
                  setErrors([])
                  setStage("upload")
                }}
              >
                ← Edit Sources
              </button>

              <button
                type="button"
                class="ai-xam-primary-button"
                onClick={() => void handleAnalyze()}
              >
                Generate Exam DNA →
              </button>

              <p>
                Learning Companion will analyze the uploaded
                materials through your configured OpenCode
                server.
              </p>
            </div>
          </section>
        </Show>

        <Show when={stage() === "analyzing"}>
          <section
            class="ai-xam-processing"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              class="ai-xam-spinner"
              aria-hidden="true"
            />

            <span class="ai-xam-eyebrow">
              ANALYZING EXAM DNA
            </span>

            <h2>Decoding your exam patterns...</h2>

            <p>
              Learning Companion is examining question formats,
              topic coverage, difficulty, and supporting
              evidence from your past exams.
            </p>
          </section>
        </Show>

        <Show when={stage() === "dashboard"}>
          <Show when={dna()} keyed>
            {(result) => (
              <>
                <ExamDNADashboard
                  dna={result}
                  sample={false}
                  onBack={() => {
                    setErrors([])
                    setStage("review")
                  }}
                />
                <div class="ai-xam-mock-entry">
                  <div><strong>Ready to put your knowledge to the test?</strong><p>Generate original questions based on these patterns and your study materials.</p></div>
                  <button type="button" class="ai-xam-primary-button" onClick={() => setStage("mock-exam")}>Build my mock exam →</button>
                </div>
              </>
            )}
          </Show>
        </Show>

        <Show when={stage() === "mock-exam"}>
          <Show when={dna()} keyed>{(result) => (
            <MockExamFlow
              dna={result}
              documents={prepared()}
              transport={examTransport()}
              onBack={() => setStage("dashboard")}
            />
          )}</Show>
        </Show>
      </div>
    </main>
  )
}

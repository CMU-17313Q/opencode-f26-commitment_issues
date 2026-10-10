import { For, Show, createSignal } from "solid-js"
import { UploadStep } from "./components/upload-step"
import type { SelectedDocument } from "./domain/types"
import {
  reviewSources,
} from "./services/source-review"
import type {
  PreparedDocument,
} from "./services/document-ingestion"
import "./ai-xam.css"

type AIxamStage = "upload" | "processing" | "review"

export default function AIxamPage() {
  const [documents, setDocuments] = createSignal<SelectedDocument[]>([])
  const [prepared, setPrepared] = createSignal<PreparedDocument[]>([])
  const [stage, setStage] = createSignal<AIxamStage>("upload")
  const [errors, setErrors] = createSignal<string[]>([])

  const handleDocumentsChange = (next: SelectedDocument[]) => {
    setDocuments(next)
    setPrepared([])
    setErrors([])
  }

  const handleReview = async () => {
    if (stage() !== "upload") return

    setStage("processing")
    setErrors([])
    setPrepared([])

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
          <span class="ai-xam-version">Learning Companion</span>
        </header>

        <Show when={stage() === "upload"}>
          <Show when={errors().length > 0}>
            <div class="ai-xam-errors" role="alert">
              <strong>Some documents could not be processed:</strong>
              <ul>
                <For each={errors()}>
                  {(error) => <li>{error}</li>}
                </For>
              </ul>
              <p>
                Remove or replace the affected files, then try again.
              </p>
            </div>
          </Show>

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
            <div class="ai-xam-spinner" aria-hidden="true" />
            <span class="ai-xam-eyebrow">PREPARING SOURCES</span>
            <h2>Checking your documents...</h2>
            <p>
              Reading text files and validating PDF attachments.
              This does not send your files to AI yet.
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
              AI-xam successfully prepared {prepared().length} documents.
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
                onClick={() => setStage("upload")}
              >
                ← Edit Sources
              </button>
              <p>
                AI analysis has not started yet. Exam DNA generation
                will be added in the next checkpoint.
              </p>
            </div>
          </section>
        </Show>
      </div>
    </main>
  )
}

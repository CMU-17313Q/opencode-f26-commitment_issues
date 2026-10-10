import { Show, createSignal } from "solid-js"
import { UploadStep } from "./components/upload-step"
import type { SelectedDocument } from "./domain/types"
import "./ai-xam.css"

export default function AIxamPage() {
  const [documents, setDocuments] = createSignal<SelectedDocument[]>([])
  const [stage, setStage] = createSignal<"upload" | "review">("upload")

  const examCount = () =>
    documents().filter((document) => document.category === "past-exam").length

  const materialCount = () =>
    documents().filter((document) => document.category === "course-material").length

  return (
    <main class="ai-xam-page">
      <div class="ai-xam-container">
        <header class="ai-xam-header">
          <div class="ai-xam-brand">
            <span class="ai-xam-brand-icon">A<span>I</span></span>
            <div>
              <h1>AI-xam</h1>
            </div>
          </div>
          <span class="ai-xam-version">Learning Companion</span>
        </header>

        <Show
          when={stage() === "upload"}
          fallback={
            <section class="ai-xam-review">
              <span class="ai-xam-eyebrow">SOURCES READY</span>
              <h2>You're ready for Exam DNA.</h2>
              <p>
                You've selected {examCount()} past exam(s) and{" "}
                {materialCount()} course-material document(s).
              </p>
              <p>
                Document extraction and AI analysis will be connected in the
                next implementation checkpoint. No files have been analyzed yet.
              </p>
              <button
                type="button"
                class="ai-xam-primary-button"
                onClick={() => setStage("upload")}
              >
                ← Back to Uploads
              </button>
            </section>
          }
        >
          <UploadStep
            documents={documents()}
            onChange={setDocuments}
            onContinue={() => setStage("review")}
          />
        </Show>
      </div>
    </main>
  )
}

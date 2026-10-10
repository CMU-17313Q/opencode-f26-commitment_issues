import { For, Show, createSignal } from "solid-js"
import { addDocuments, documentsReady, removeDocument, MAX_DOCUMENTS_PER_CATEGORY } from "../domain/documents"
import type { DocumentCategory, SelectedDocument } from "../domain/types"

type UploadStepProps = {
  documents: SelectedDocument[]
  onChange: (documents: SelectedDocument[]) => void
  onContinue: () => void
}

type UploadZoneProps = {
  category: DocumentCategory
  title: string
  description: string
  documents: SelectedDocument[]
  onFiles: (category: DocumentCategory, files: File[]) => void
  onRemove: (id: string) => void
}

function formatSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function UploadZone(props: UploadZoneProps) {
  const [dragging, setDragging] = createSignal(false)

  const onFilesSelected = (event: Event & { currentTarget: HTMLInputElement }) => {
    const input = event.currentTarget
    props.onFiles(props.category, Array.from(input.files ?? []))
    input.value = ""
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    props.onFiles(props.category, Array.from(event.dataTransfer?.files ?? []))
  }

  return (
    <section class="ai-xam-zone">
      <div class="ai-xam-zone-header">
        <div>
          <h2>{props.title}</h2>
          <p>{props.description}</p>
        </div>
        <span class="ai-xam-count">
          {props.documents.length}/{MAX_DOCUMENTS_PER_CATEGORY}
        </span>
      </div>

      <label
        class="ai-xam-drop"
        classList={{ "ai-xam-drop--active": dragging() }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          class="ai-xam-file-input"
          type="file"
          multiple
          accept=".pdf,.txt,.md"
          onChange={onFilesSelected}
          aria-label={`Upload ${props.title.toLowerCase()}`}
        />
        <span class="ai-xam-drop-icon" aria-hidden="true">↑</span>
        <strong>Choose files or drag them here</strong>
        <span>PDF, TXT, MD · Maximum 10 MB per file</span>
      </label>

      <Show when={props.documents.length > 0}>
        <ul class="ai-xam-file-list">
          <For each={props.documents}>
            {(document) => (
              <li class="ai-xam-file">
                <span class="ai-xam-file-icon" aria-hidden="true">
                  {document.format.toUpperCase()}
                </span>
                <div class="ai-xam-file-details">
                  <strong title={document.name}>{document.name}</strong>
                  <span>{formatSize(document.size)}</span>
                </div>
                <button
                  type="button"
                  class="ai-xam-remove"
                  aria-label={`Remove ${document.name}`}
                  onClick={() => props.onRemove(document.id)}
                >
                  Remove
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}

export function UploadStep(props: UploadStepProps) {
  const [errors, setErrors] = createSignal<string[]>([])

  const filesFor = (category: DocumentCategory) =>
    props.documents.filter((document) => document.category === category)

  const handleFiles = (category: DocumentCategory, files: File[]) => {
    if (files.length === 0) return

    const result = addDocuments(props.documents, files, category)
    props.onChange(result.documents)
    setErrors(result.errors)
  }

  const handleRemove = (id: string) => {
    props.onChange(removeDocument(props.documents, id))
    setErrors([])
  }

  return (
    <section class="ai-xam-upload">
      <div class="ai-xam-section-heading">
        <span class="ai-xam-eyebrow">STEP 01 / YOUR SOURCES</span>
        <h1>What are we preparing for?</h1>
        <p>
          Give AI-xam your previous exams to understand how you're assessed,
          and your study materials to understand what you need to know.
        </p>
      </div>

      <div class="ai-xam-upload-grid">
        <UploadZone
          category="past-exam"
          title="Past Exams"
          description="Teach AI-xam your instructor's question styles."
          documents={filesFor("past-exam")}
          onFiles={handleFiles}
          onRemove={handleRemove}
        />

        <UploadZone
          category="course-material"
          title="Course Materials"
          description="Provide the concepts your next exam may cover."
          documents={filesFor("course-material")}
          onFiles={handleFiles}
          onRemove={handleRemove}
        />
      </div>

      <Show when={errors().length > 0}>
        <div class="ai-xam-errors" role="alert">
          <strong>Some files couldn't be added:</strong>
          <ul>
            <For each={errors()}>{(error) => <li>{error}</li>}</For>
          </ul>
        </div>
      </Show>

      <div class="ai-xam-upload-footer">
        <div class="ai-xam-readiness" aria-live="polite">
          <Show
            when={documentsReady(props.documents)}
            fallback="Add at least one document to each category to continue."
          >
            ✓ Your source collection is ready.
          </Show>
        </div>

        <button
          type="button"
          class="ai-xam-primary-button"
          disabled={!documentsReady(props.documents)}
          onClick={props.onContinue}
        >
          Review Sources →
        </button>
      </div>
    </section>
  )
}

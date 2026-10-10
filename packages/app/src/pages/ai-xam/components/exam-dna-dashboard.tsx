import { For, Show } from "solid-js"
import type { ExamDNA } from "../domain/exam-dna"
import "./exam-dna-dashboard.css"

// Preview data only. Never represent this as analysis
// of a student's uploaded documents.
export const SAMPLE_EXAM_DNA: ExamDNA = {
  analyzedExamIds: ["sample-exam"],
  typicalQuestionCount: 3,
  typicalDurationMinutes: null,
  difficulty: "unknown",
  questionTypes: [
    {
      kind: "short-answer",
      observedCount: 3,
      evidence: [
        {
          documentId: "sample-exam",
          location: "Q1",
          description: "Define unit testing.",
        },
        {
          documentId: "sample-exam",
          location: "Q2",
          description:
            "Explain functional and non-functional requirements.",
        },
        {
          documentId: "sample-exam",
          location: "Q3",
          description: "Describe continuous integration.",
        },
      ],
    },
  ],
  topics: [
    {
      name: "Unit Testing",
      observedCount: 1,
      evidence: [
        {
          documentId: "sample-exam",
          location: "Q1",
          description: "Definition of unit testing.",
        },
      ],
    },
    {
      name: "Software Requirements",
      observedCount: 1,
      evidence: [
        {
          documentId: "sample-exam",
          location: "Q2",
          description:
            "Functional and non-functional requirements.",
        },
      ],
    },
    {
      name: "Continuous Integration",
      observedCount: 1,
      evidence: [
        {
          documentId: "sample-exam",
          location: "Q3",
          description:
            "Understanding of continuous integration.",
        },
      ],
    },
  ],
  observations: [
    "All three questions ask students to explain or define software engineering concepts.",
    "Each of the three identified topics appears once.",
    "No coding or multiple-choice questions are shown.",
  ],
  limitations: [
    "This preview uses fictional data, not uploaded documents.",
    "Only one short sample exam is represented.",
    "Exam duration and difficulty cannot be established.",
  ],
}

type Props = {
  dna: ExamDNA
  sample: boolean
  onBack: () => void
}

function formatLabel(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function countLabel(value: number | null) {
  return value === null ? "Unknown" : value.toString()
}

export function ExamDNADashboard(props: Props) {
  const maxTopicCount = () =>
    Math.max(
      1,
      ...props.dna.topics.map((topic) => topic.observedCount ?? 0),
    )

  return (
    <section class="ai-xam-dna">
      <div class="ai-xam-dna-heading">
        <div>
          <span class="ai-xam-dna-eyebrow">
            STEP 03 / EXAM DNA
          </span>
          <h2>Decode the exam.</h2>
          <p>
            Explore question patterns, topic coverage, and the
            evidence behind each finding.
          </p>
        </div>

        <button
          type="button"
          class="ai-xam-dna-back"
          onClick={props.onBack}
        >
          ← Back to sources
        </button>
      </div>

      <Show when={props.sample}>
        <div class="ai-xam-dna-notice" role="note">
          <strong>Sample dashboard preview</strong>
          <span>
            These results come from a fictional three-question exam.
            Your uploaded documents have not been analyzed by AI.
          </span>
        </div>
      </Show>

      <div class="ai-xam-dna-stats">
        <div class="ai-xam-dna-stat">
          <span>Questions observed</span>
          <strong>
            {countLabel(props.dna.typicalQuestionCount)}
          </strong>
        </div>

        <div class="ai-xam-dna-stat">
          <span>Exam duration</span>
          <strong>
            {props.dna.typicalDurationMinutes === null
              ? "Unknown"
              : `${props.dna.typicalDurationMinutes} min`}
          </strong>
        </div>

        <div class="ai-xam-dna-stat">
          <span>Difficulty</span>
          <strong>{formatLabel(props.dna.difficulty)}</strong>
        </div>
      </div>

      <div class="ai-xam-dna-grid">
        <article class="ai-xam-dna-panel">
          <div class="ai-xam-dna-panel-heading">
            <h3>Topic distribution</h3>
            <p>
              Observed appearances in the analyzed exam.
            </p>
          </div>

          <Show
            when={props.dna.topics.length > 0}
            fallback={<p>No topics were identified.</p>}
          >
            <div class="ai-xam-dna-topics">
              <For each={props.dna.topics}>
                {(topic) => (
                  <div class="ai-xam-dna-topic">
                    <div class="ai-xam-dna-topic-heading">
                      <strong>{topic.name}</strong>
                      <span>
                        {countLabel(topic.observedCount)}
                        {" observed"}
                      </span>
                    </div>

                    <div
                      class="ai-xam-dna-track"
                      aria-hidden="true"
                    >
                      <div
                        class="ai-xam-dna-fill"
                        style={{
                          width: `${
                            ((topic.observedCount ?? 0) /
                              maxTopicCount()) *
                            100
                          }%`,
                        }}
                      />
                    </div>

                    <ul class="ai-xam-dna-evidence">
                      <For each={topic.evidence}>
                        {(evidence) => (
                          <li>
                            <strong>{evidence.location}</strong>
                            {" · "}
                            {evidence.description}
                          </li>
                        )}
                      </For>
                    </ul>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </article>

        <article class="ai-xam-dna-panel">
          <div class="ai-xam-dna-panel-heading">
            <h3>Question formats</h3>
            <p>
              Formats supported by evidence from past exams.
            </p>
          </div>

          <Show
            when={props.dna.questionTypes.length > 0}
            fallback={<p>No question formats were identified.</p>}
          >
            <For each={props.dna.questionTypes}>
              {(format) => (
                <div class="ai-xam-dna-format">
                  <div class="ai-xam-dna-format-row">
                    <strong>{formatLabel(format.kind)}</strong>
                    <span>
                      {countLabel(format.observedCount)}
                      {" observed"}
                    </span>
                  </div>

                  <ul class="ai-xam-dna-evidence">
                    <For each={format.evidence}>
                      {(evidence) => (
                        <li>
                          <strong>{evidence.location}</strong>
                          {" · "}
                          {evidence.description}
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              )}
            </For>
          </Show>
        </article>
      </div>

      <div class="ai-xam-dna-grid">
        <article class="ai-xam-dna-panel">
          <div class="ai-xam-dna-panel-heading">
            <h3>Key observations</h3>
            <p>What the available exam evidence suggests.</p>
          </div>

          <ul class="ai-xam-dna-list">
            <For each={props.dna.observations}>
              {(observation) => <li>{observation}</li>}
            </For>
          </ul>
        </article>

        <article class="ai-xam-dna-panel">
          <div class="ai-xam-dna-panel-heading">
            <h3>Limitations</h3>
            <p>
              What AI-xam cannot confidently establish.
            </p>
          </div>

          <ul class="ai-xam-dna-list">
            <For each={props.dna.limitations}>
              {(limitation) => <li>{limitation}</li>}
            </For>
          </ul>
        </article>
      </div>
    </section>
  )
}

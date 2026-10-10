import { For, Show, createEffect, createSignal, onCleanup } from "solid-js"
import { QUESTION_FORMATS, type ExamDNA, type QuestionFormat } from "../domain/exam-dna"
import {
  calculateResult, weakTopics, type ExamDifficulty, type ExamResult,
  type ExamSettings, type MockExam,
} from "../domain/mock-exam"
import { generateMockExam, gradeMockExam } from "../ai/mock-exam-ai"
import type { ExamDNATransport } from "../ai/analyze-exam-dna"
import type { PreparedDocument } from "../services/document-ingestion"
import "./mock-exam-flow.css"

type Props = {
  dna: ExamDNA
  documents: PreparedDocument[]
  transport: ExamDNATransport
  onBack: () => void
}
type Phase = "setup" | "generating" | "taking" | "grading" | "grading-error" | "results"

const readable = (name: string) => name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
const timeLabel = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`

export function MockExamFlow(props: Props) {
  const [phase, setPhase] = createSignal<Phase>("setup")
  const [error, setError] = createSignal("")
  const [settings, setSettings] = createSignal<ExamSettings>({
    difficulty: "moderate", questionCount: 5,
    durationMinutes: Math.min(180, Math.max(5, props.dna.typicalDurationMinutes ?? 45)),
    formats: ["short-answer", "problem-solving", "essay"],
  })
  const [exam, setExam] = createSignal<MockExam>()
  const [answers, setAnswers] = createSignal<Record<string, string>>({})
  const [flagged, setFlagged] = createSignal<string[]>([])
  const [index, setIndex] = createSignal(0)
  const [deadline, setDeadline] = createSignal(0)
  const [remaining, setRemaining] = createSignal(0)
  const [result, setResult] = createSignal<ExamResult>()
  const [original, setOriginal] = createSignal<ExamResult>()
  const [isRetake, setIsRetake] = createSignal(false)
  const [priorQuestions, setPriorQuestions] = createSignal<string[]>([])

  const changeSettings = (update: Partial<ExamSettings>) => setSettings((s) => ({ ...s, ...update }))
  const toggleFormat = (kind: QuestionFormat, enabled: boolean) =>
    changeSettings({ formats: enabled ? [...settings().formats, kind] : settings().formats.filter((x) => x !== kind) })
  const answeredCount = () => exam()?.questions.filter((q) => (answers()[q.id] ?? "").trim().length > 0).length ?? 0
  const currentQuestion = () => exam()?.questions[index()]

  const startExam = async (topics?: string[]) => {
    if (phase() === "generating") return
    setError("")
    setPhase("generating")
    try {
      const next = await generateMockExam({
        dna: props.dna, documents: props.documents, settings: settings(),
        transport: props.transport, retakeTopics: topics,
        previousQuestions: priorQuestions(),
      })
      setExam(next)
      if (topics?.length) setIsRetake(true)
      setAnswers({})
      setFlagged([])
      setIndex(0)
      setRemaining(settings().durationMinutes * 60)
      setDeadline(Date.now() + settings().durationMinutes * 60 * 1000)
      setPhase("taking")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Exam generation failed. Please retry.")
      setPhase(result() ? "results" : "setup")
    }
  }

  const submitExam = async () => {
    if (phase() !== "taking" && phase() !== "grading-error") return
    setError("")
    setPhase("grading")
    try {
      const current = exam()
      if (!current) throw new Error("No exam to grade.")
      const marked = await gradeMockExam({ exam: current, answers: answers(), transport: props.transport })
      const scored = calculateResult(current, answers(), marked)
      setResult(scored)
      if (!isRetake()) setOriginal(scored)
      setPhase("results")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Grading failed. Please retry.")
      // Preserve student answers; retry manually to avoid repeated paid requests.
      setPhase("grading-error")
    }
  }

  createEffect(() => {
    if (phase() !== "taking") return
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline() - Date.now()) / 1000))
      setRemaining(seconds)
      if (seconds === 0) void submitExam()
    }
    tick()
    const id = setInterval(tick, 1000)
    onCleanup(() => clearInterval(id))
  })

  const retake = () => {
    const last = result()
    if (!last) return
    const topics = weakTopics(last)
    if (!topics.length) return
    setPriorQuestions((current) => [...current, ...last.exam.questions.map((q) => q.prompt)])
    void startExam(topics)
  }

  return (
    <section class="ai-xam-mock">
      <div class="ai-xam-mock-top">
        <div>
          <span class="ai-xam-eyebrow">STEP 04 / MOCK ASSESSMENT</span>
          <h2>Practice like it's exam day.</h2>
          <p>Questions are generated from your materials and the exam patterns Claude identified.</p>
        </div>
        <Show when={phase() === "setup" || phase() === "results"}>
          <button type="button" class="ai-xam-mock-secondary" onClick={props.onBack}>← Exam DNA</button>
        </Show>
      </div>

      <Show when={error()}>
        <div class="ai-xam-mock-error" role="alert">{error()}</div>
      </Show>

      <Show when={phase() === "setup"}>
        <div class="ai-xam-mock-panel ai-xam-mock-setup">
          <h3>Customize your mock exam</h3>
          <div class="ai-xam-mock-fields">
            <label>Difficulty
              <select value={settings().difficulty} onChange={(e) => changeSettings({ difficulty: e.currentTarget.value as ExamDifficulty })}>
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="hard">Hard</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
            <label>Number of questions
              <input type="number" min="1" max="20" value={settings().questionCount} onInput={(e) => changeSettings({ questionCount: Number(e.currentTarget.value) })} />
            </label>
            <label>Duration (minutes)
              <input type="number" min="5" max="180" value={settings().durationMinutes} onInput={(e) => changeSettings({ durationMinutes: Number(e.currentTarget.value) })} />
            </label>
          </div>
          <fieldset class="ai-xam-mock-formats">
            <legend>Question formats</legend>
            <div>
              <For each={[...QUESTION_FORMATS]}>{(kind) => (
                <label>
                  <input type="checkbox" checked={settings().formats.includes(kind)} onChange={(e) => toggleFormat(kind, e.currentTarget.checked)} />
                  {readable(kind)}
                </label>
              )}</For>
            </div>
          </fieldset>
          <p class="ai-xam-mock-hint">Mark schemes are hidden until submission. The AI model may take a little time to generate an exam.</p>
          <button type="button" class="ai-xam-primary-button" onClick={() => void startExam()}>Generate mock exam →</button>
        </div>
      </Show>

      <Show when={phase() === "generating" || phase() === "grading"}>
        <div class="ai-xam-mock-busy" role="status" aria-live="polite" aria-busy="true">
          <div class="ai-xam-spinner" aria-hidden="true" />
          <h3>{phase() === "generating" ? "Creating original questions..." : "Grading your answers..."}</h3>
          <p>{phase() === "generating" ? "Grounding questions in your uploaded material." : "Reviewing each answer against the exam rubric."}</p>
        </div>
      </Show>

      <Show when={phase() === "grading-error"}>
        <div class="ai-xam-mock-panel">
          <h3>Your answers are safe.</h3>
          <p>Grading failed, but all answers are still saved. Retry only when your model connection is ready.</p>
          <button type="button" class="ai-xam-primary-button" onClick={() => void submitExam()}>Retry grading</button>
        </div>
      </Show>

      <Show when={phase() === "taking"}>
        <Show when={exam()} keyed>{(paper) => (
          <div class="ai-xam-mock-panel">
            <div class="ai-xam-mock-exam-head">
              <div><h3>{paper.title}</h3><p>{answeredCount()} / {paper.questions.length} answered · {flagged().length} flagged</p></div>
              <div class="ai-xam-mock-timer" role="timer" aria-label="Time remaining">{timeLabel(remaining())}</div>
            </div>
            <div class="ai-xam-mock-nav" aria-label="Exam question navigation">
              <For each={paper.questions}>{(q, i) => (
                <button type="button" aria-label={`Question ${i() + 1}${flagged().includes(q.id) ? ", flagged" : ""}`} aria-current={index() === i() ? "step" : undefined}
                  classList={{ active: index() === i(), answered: !!answers()[q.id]?.trim(), flagged: flagged().includes(q.id) }}
                  onClick={() => setIndex(i())}>{i() + 1}{flagged().includes(q.id) ? " ⚑" : ""}</button>
              )}</For>
            </div>
            <Show when={currentQuestion()} keyed>{(q) => (
              <article class="ai-xam-mock-question">
                <div class="ai-xam-mock-question-meta"><span>Question {index() + 1} / {paper.questions.length}</span><span>{readable(q.kind)} · {q.topic} · {q.points} points</span></div>
                <h4>{q.prompt}</h4>
                <Show when={q.kind === "multiple-choice"} fallback={
                  <textarea rows="7" value={answers()[q.id] ?? ""} placeholder="Write your answer here..." aria-label={`Answer to question ${index() + 1}`}
                    onInput={(e) => setAnswers((all) => ({ ...all, [q.id]: e.currentTarget.value }))} />
                }>
                  <div class="ai-xam-mock-options">
                    <For each={q.choices}>{(choice) => (
                      <label><input type="radio" name={`answer-${q.id}`} checked={answers()[q.id] === choice}
                        onChange={() => setAnswers((all) => ({ ...all, [q.id]: choice }))} />{choice}</label>
                    )}</For>
                  </div>
                </Show>
                <label class="ai-xam-mock-flag"><input type="checkbox" checked={flagged().includes(q.id)}
                  onChange={(e) => setFlagged((all) => e.currentTarget.checked ? [...all, q.id] : all.filter((id) => id !== q.id))} /> Flag for review</label>
              </article>
            )}</Show>
            <div class="ai-xam-mock-actions">
              <button type="button" class="ai-xam-mock-secondary" disabled={index() === 0} onClick={() => setIndex(index() - 1)}>← Previous</button>
              <Show when={index() < paper.questions.length - 1}>
                <button type="button" class="ai-xam-mock-secondary" onClick={() => setIndex(index() + 1)}>Next →</button>
              </Show>
              <button type="button" class="ai-xam-primary-button" onClick={() => void submitExam()}>Submit for grading</button>
            </div>
          </div>
        )}</Show>
      </Show>

      <Show when={phase() === "results"}>
        <Show when={result()} keyed>{(score) => (
          <div class="ai-xam-mock-panel">
            <div class="ai-xam-mock-score"><div><span>YOUR SCORE</span><strong>{score.percentage}%</strong><p>{score.totalEarned} / {score.totalPossible} points</p></div>
              <Show when={isRetake() && original()}>{(previous) => (
                <div><span>IMPROVEMENT</span><strong>{score.percentage - previous().percentage > 0 ? "+" : ""}{score.percentage - previous().percentage} pts</strong><p>Original: {previous().percentage}% · Retake: {score.percentage}%</p></div>
              )}</Show>
            </div>
            <h3>Topic performance</h3>
            <div class="ai-xam-mock-topics">
              <For each={score.topics}>{(topic) => (
                <div><div class="ai-xam-mock-topic-head"><strong>{topic.topic}</strong><span>{topic.earned}/{topic.possible} · {topic.percentage}%</span></div>
                  <div class="ai-xam-mock-track" role="meter" aria-label={`${topic.topic} score`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={topic.percentage}><span style={{ width: `${topic.percentage}%` }} /></div>
                </div>
              )}</For>
            </div>
            <h3>Question-by-question feedback</h3>
            <div class="ai-xam-mock-feedback">
              <For each={score.exam.questions}>{(q, i) => {
                const grade = score.grade.grades.find((g) => g.questionId === q.id)
                return <article><h4>Question {i() + 1} · {q.topic} <span>{grade?.earnedPoints ?? 0}/{q.points}</span></h4>
                  <p>{q.prompt}</p>
                  <p><strong>Your answer: </strong>{score.answers[q.id] || "(No answer)"}</p>
                  <p><strong>Feedback: </strong>{grade?.feedback}</p>
                  <details><summary>See expected answer and marking criteria</summary><p><strong>Reference answer:</strong> {q.referenceAnswer}</p><p><strong>Rubric:</strong> {q.rubric}</p></details>
                </article>
              }}</For>
            </div>
            <div class="ai-xam-mock-actions">
              <Show when={weakTopics(score).length > 0} fallback={<p class="ai-xam-mock-hint">No topics scored below 70%. Great work!</p>}>
                <button type="button" class="ai-xam-primary-button" onClick={retake}>Targeted retake ({weakTopics(score).length} weak topics) →</button>
              </Show>
              <button type="button" class="ai-xam-mock-secondary" onClick={() => { setIsRetake(false); setOriginal(undefined); setResult(undefined); setPriorQuestions([]); setPhase("setup") }}>Create a new exam</button>
            </div>
          </div>
        )}</Show>
      </Show>
    </section>
  )
}

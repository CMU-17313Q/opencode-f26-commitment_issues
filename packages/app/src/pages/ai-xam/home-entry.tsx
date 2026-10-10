import { Show, createSignal } from "solid-js"
import AIxamPage from "./ai-xam-page"
import "./home-entry.css"

/** Independent home card. Keeps Focus Mode mounted and unchanged. */
export function AIxamHomeEntry(props: { serverURL?: string }) {
  const [open, setOpen] = createSignal(false)
  return (
    <section class="ai-xam-home-entry" aria-label="AI-xam learning companion">
      <div class="ai-xam-home-entry__bar">
        <div><h2>AI-xam · Learning Companion</h2>
          <p>Upload past papers, decode the exam, practice with Claude, and track improvement.</p></div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open()}>
          {open() ? "Close AI-xam" : "Open AI-xam →"}
        </button>
      </div>
      <Show when={open()}><AIxamPage serverURL={props.serverURL} /></Show>
    </section>
  )
}

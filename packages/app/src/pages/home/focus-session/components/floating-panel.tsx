import { Show } from "solid-js"
import { focusCopy } from "../copy"
import type { FocusSession } from "../session-store"
import { FocusActivePanel } from "./active-panel"

// Shown on every page while a session runs, except when the home card already shows it.
export function FocusFloatingPanel(props: { session: FocusSession }) {
  const view = props.session.view
  return (
    <Show when={view.snapshot.phase !== "idle" && view.cardsMounted === 0}>
      <aside class="focus-card focus-card--floating" aria-label={focusCopy.title}>
        <FocusActivePanel session={props.session} compact />
      </aside>
    </Show>
  )
}

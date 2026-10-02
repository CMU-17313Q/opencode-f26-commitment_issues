import { type JSX, onCleanup, onMount } from "solid-js"
import { Portal } from "solid-js/web"

// Full-window overlay shown during work. Everything outside it is made inert (no clicks,
// no focus) and app keyboard shortcuts are swallowed, so only the session panel works.
export function FocusLockOverlay(props: { children: JSX.Element }) {
  const state = { root: undefined as HTMLDivElement | undefined, inerted: [] as HTMLElement[] }

  const blockKeys = (event: KeyboardEvent) => {
    if (state.root?.contains(event.target as Node)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  onMount(() => {
    const host = state.root?.parentElement
    state.inerted = [...document.body.children].filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== host && !element.inert,
    )
    state.inerted.forEach((element) => {
      element.inert = true
    })
    window.addEventListener("keydown", blockKeys, true)
    state.root?.querySelector<HTMLElement>("button")?.focus()
  })

  onCleanup(() => {
    window.removeEventListener("keydown", blockKeys, true)
    state.inerted.forEach((element) => {
      element.inert = false
    })
  })

  return (
    <Portal>
      <div
        ref={(element) => {
          state.root = element
        }}
        class="focus-lock"
        role="dialog"
        aria-modal="true"
      >
        {props.children}
      </div>
    </Portal>
  )
}

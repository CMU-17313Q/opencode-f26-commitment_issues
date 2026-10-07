import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Show } from "solid-js"
import { formatRemaining } from "../controller/format"
import { focusCopy } from "../copy"
import type { FocusSession } from "../session-store"
import { FocusMeter } from "./focus-meter"

// The running-session view, shared by the home card and the floating panel.
export function FocusActivePanel(props: { session: FocusSession; compact?: boolean }) {
  const view = props.session.view
  const phase = () => view.snapshot.phase
  const checkIn = () => phase() === "work" && (view.status === "idle" || view.status === "unresponsive")
  const phaseLabel = () => {
    if (view.snapshot.paused) return focusCopy.paused
    if (phase() === "work") return focusCopy.working
    return focusCopy.onBreak
  }

  return (
    <div class="focus-active" data-compact={props.compact ? "" : undefined}>
      <Show
        when={phase() !== "break-ended"}
        fallback={
          <>
            <p class="focus-message">{focusCopy.breakEnded}</p>
            <div class="focus-row">
              <ButtonV2 variant="contrast" onClick={() => props.session.controller.nextRound()}>
                {focusCopy.anotherRound}
              </ButtonV2>
              <ButtonV2 onClick={() => props.session.controller.finish()}>{focusCopy.done}</ButtonV2>
            </div>
          </>
        }
      >
        <div class="focus-active__header">
          <span>{phaseLabel()}</span>
          <span>{focusCopy.round(view.snapshot.round)}</span>
        </div>
        <div class="focus-active__time" role="timer" aria-live="off">
          {formatRemaining(view.snapshot.remainingMs)}
        </div>
        <FocusMeter timeline={view.focus.timeline} score={view.focus.score} band={view.focus.band} />
        <Show when={!props.compact && phase() === "work"}>
          <p class="focus-message">{focusCopy.studyMode}</p>
        </Show>
        <Show when={phase() === "work" && !view.fullscreen}>
          <ButtonV2 variant="ghost" onClick={() => props.session.enterFullscreen()}>
            {focusCopy.fullscreen}
          </ButtonV2>
        </Show>
        <Show when={view.celebrate && phase() === "break"}>
          <p class="focus-message">{focusCopy.workComplete}</p>
        </Show>
        <Show when={checkIn()}>
          <div class="focus-checkin" role="alertdialog" aria-label={focusCopy.checkIn}>
            <strong>{focusCopy.checkIn}</strong>
            <span>{focusCopy.checkInHint}</span>
            <div class="focus-row">
              <ButtonV2
                variant="contrast"
                disabled={view.help === "sending"}
                onClick={() => void props.session.askForHelp()}
              >
                {focusCopy.yes}
              </ButtonV2>
              <ButtonV2 variant="ghost" onClick={() => props.session.monitor.answer(false)}>
                {focusCopy.no}
              </ButtonV2>
            </div>
          </div>
        </Show>
        <Show when={props.session.message()}>
          <p class="focus-message" data-tone={view.help === "sending" ? undefined : "error"} role="status">
            {props.session.message()}
          </p>
        </Show>
        <div class="focus-row">
          <Show
            when={view.snapshot.paused}
            fallback={<ButtonV2 onClick={() => props.session.controller.pause()}>{focusCopy.pause}</ButtonV2>}
          >
            <ButtonV2 onClick={() => props.session.controller.resume()}>{focusCopy.resume}</ButtonV2>
          </Show>
          <ButtonV2 variant="danger" onClick={() => props.session.controller.end()}>
            {focusCopy.end}
          </ButtonV2>
        </div>
      </Show>
    </div>
  )
}

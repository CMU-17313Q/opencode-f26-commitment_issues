import { For } from "solid-js"
import type { FocusBand } from "../controller/focus-score"
import type { TimelineView } from "../controller/focus-timeline"
import { focusCopy } from "../copy"

// The round as a bar that fills left to right; each stretch is colored by what the student
// was doing then: green = focused, yellow = distracted, red = not focused. No visible text;
// screen readers get the overall focus score through the meter role.
export function FocusMeter(props: { timeline: TimelineView; score: number; band: FocusBand }) {
  return (
    <div
      class="focus-meter"
      role="meter"
      aria-label={focusCopy.meterLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={props.score}
      aria-valuetext={focusCopy.meterValue(props.band, props.score)}
    >
      <For each={props.timeline.segments}>
        {(segment) => (
          <span
            class="focus-meter__segment"
            data-status={segment.status}
            style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
          />
        )}
      </For>
    </div>
  )
}

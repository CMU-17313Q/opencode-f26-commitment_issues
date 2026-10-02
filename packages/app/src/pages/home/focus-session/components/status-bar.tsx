import type { ActivityStatus } from "../controller/idle-monitor"
import { focusCopy } from "../copy"

export function FocusStatusBar(props: { status: ActivityStatus }) {
  return (
    <div class="focus-status" data-status={props.status} role="status" aria-live="polite">
      <span class="focus-status__bar" aria-hidden="true" />
      <span class="focus-status__label">{focusCopy.status[props.status]}</span>
    </div>
  )
}

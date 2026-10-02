import { type FocusHistoryRecord, trackHistory } from "./controller/history"
import { createIdleMonitor, followSession } from "./controller/idle-monitor"
import { silentAudio, systemClock } from "./controller/ports"
import { createFocusSessionController } from "./controller/session-controller"

// One session per app window. Kept at module level so a running break timer survives
// navigating away from the home page and back.
function createFocusSession() {
  const clock = systemClock
  // Real music (Howler) is wired in with #19; until then "No music" behaviour is used.
  const controller = createFocusSessionController({ clock, audio: silentAudio })
  const monitor = createIdleMonitor({ clock })
  followSession(controller, monitor)
  const sink = { save: undefined as ((record: FocusHistoryRecord) => void) | undefined }
  trackHistory({ clock, controller, monitor, save: (record) => sink.save?.(record) })
  return {
    clock,
    controller,
    monitor,
    // The card registers where records are persisted while it is mounted.
    onRecord(save: (record: FocusHistoryRecord) => void) {
      sink.save = save
      return () => {
        if (sink.save === save) sink.save = undefined
      }
    },
  }
}

const state = { session: undefined as ReturnType<typeof createFocusSession> | undefined }

export function focusSession() {
  if (!state.session) state.session = createFocusSession()
  return state.session
}

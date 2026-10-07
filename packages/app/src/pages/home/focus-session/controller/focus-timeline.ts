import type { ActivityStatus } from "./idle-monitor"

export type TimelineStatus = Exclude<ActivityStatus, "neutral">

// One colored stretch of the round: green (active), yellow (idle), red (unresponsive).
// Times are elapsed work milliseconds, so paused time does not take up space.
export type TimelineSegment = { status: TimelineStatus; from: number; to?: number }

export type TimelineView = {
  totalMs: number
  segments: Array<{ status: TimelineStatus; left: number; width: number }>
}

// Records the student's status over one work round.
export function createFocusTimeline() {
  const state = { segments: [] as TimelineSegment[] }

  const closeOpen = (at: number) => {
    const open = state.segments.at(-1)
    if (open && open.to === undefined) open.to = at
  }

  return {
    segments: () => state.segments.map((segment) => ({ ...segment })),
    reset() {
      state.segments = []
    },
    mark(status: ActivityStatus, at: number) {
      const open = state.segments.at(-1)
      if (open && open.to === undefined && open.status === status) return
      closeOpen(at)
      if (status === "neutral") return
      state.segments.push({ status, from: at })
    },
  }
}

export type FocusTimeline = ReturnType<typeof createFocusTimeline>

// Converts segments to percentages of the round for drawing. The open segment runs to "now".
export function layoutTimeline(segments: readonly TimelineSegment[], elapsedMs: number, totalMs: number): TimelineView {
  if (totalMs <= 0) return { totalMs, segments: [] }
  return {
    totalMs,
    segments: segments
      .map((segment) => {
        const to = Math.min(segment.to ?? elapsedMs, totalMs)
        return {
          status: segment.status,
          left: (segment.from / totalMs) * 100,
          width: (Math.max(0, to - segment.from) / totalMs) * 100,
        }
      })
      .filter((segment) => segment.width > 0),
  }
}

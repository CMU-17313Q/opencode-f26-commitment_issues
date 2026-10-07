// All user-visible Focus Session text lives here so it can move to the shared i18n
// dictionaries in one step later, without touching shared files during the sprint.
export const focusCopy = {
  title: "Focus Session",
  subtitle:
    "Timed work in a study tab with the AI, then an automatic break. opencode checks in if you go quiet or leave.",
  timing: "Timing",
  presetCustom: "Custom",
  workMinutes: "Work (min)",
  breakMinutes: "Break (min)",
  start: "Start session",
  pause: "Pause",
  resume: "Resume",
  end: "End session",
  working: "Focus time",
  onBreak: "Break time",
  paused: "Paused",
  round: (round: number) => `Round ${round}`,
  studyMode: "Stay in your study tab and work with the AI. Other tabs unlock on your break.",
  tabsLocked: "Tabs are locked during focus time. They unlock on your break.",
  needProject: "Add a project first so opencode can open a study tab for you.",
  workComplete: "Work round complete. Enjoy your break!",
  breakEnded: "Break's over. Start another round?",
  anotherRound: "Start another round",
  done: "Done",
  // Screen-reader only: the meter itself shows no text.
  meterLabel: "Focus level",
  meterValue: (band: "focused" | "distracted" | "unfocused", score: number) =>
    `${{ focused: "Focused", distracted: "Distracted", unfocused: "Not focused" }[band]}, ${score}%`,
  fullscreen: "Return to full screen",
  checkIn: "Need help?",
  checkInHint: "You've been quiet or stepped away for a bit.",
  yes: "Yes, help me",
  no: "No, I'm fine",
  helpSending: "Asking the agent…",
  helpNoProject: "Add a project to ask the agent for help.",
  helpFailed: "Couldn't reach the agent. Try again.",
  history: (sessions: number, minutes: number) =>
    `${sessions} ${sessions === 1 ? "session" : "sessions"} · ${minutes} focus ${minutes === 1 ? "minute" : "minutes"}`,
  averageFocus: (score: number) => `${score}% focused on average`,
}

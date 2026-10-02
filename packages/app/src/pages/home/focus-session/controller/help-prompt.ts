// The subset of the opencode SDK client the help request needs, so tests can pass a fake.
export type HelpClient = {
  session: {
    create(input: { directory: string; title?: string }): Promise<{ data?: { id: string } }>
    promptAsync(input: {
      sessionID: string
      directory: string
      parts: Array<{ type: "text"; text: string }>
    }): Promise<unknown>
  }
}

export type HelpContext = {
  round: number
  workMinutes: number
  minutesLeft: number
  companionName?: string
}

export type HelpResult = { ok: true; sessionID: string } | { ok: false; reason: "no-project" | "failed" }

export const HELP_SESSION_TITLE = "Focus session: help request"

// Learning companion tone: help the student get unstuck without doing the work for them.
export function buildHelpPrompt(context: HelpContext) {
  const who = context.companionName ? `My focus companion ${context.companionName} noticed` : "I noticed"
  return [
    `${who} I've been inactive for a few minutes during a focus session`,
    `(round ${context.round}, ${context.workMinutes} minute work period, about ${context.minutesLeft} minutes left).`,
    "I think I'm stuck. Please help me get unstuck as a learning companion:",
    "1. Ask me briefly what I'm working on and where I'm stuck, if it isn't clear from this project.",
    "2. Suggest one small next step I can take right now.",
    "3. Explain the idea behind it so I learn, instead of writing the whole solution for me.",
  ].join("\n")
}

export async function requestHelp(client: HelpClient, directory: string | undefined, text: string) {
  if (!directory) return { ok: false, reason: "no-project" } satisfies HelpResult
  const created = await client.session.create({ directory, title: HELP_SESSION_TITLE }).catch(() => undefined)
  const sessionID = created?.data?.id
  if (!sessionID) return { ok: false, reason: "failed" } satisfies HelpResult
  const sent = await client.session
    .promptAsync({ sessionID, directory, parts: [{ type: "text", text }] })
    .then(() => true)
    .catch(() => false)
  if (!sent) return { ok: false, reason: "failed" } satisfies HelpResult
  return { ok: true, sessionID } satisfies HelpResult
}

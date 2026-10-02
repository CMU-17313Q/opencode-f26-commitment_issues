import { describe, expect, test } from "bun:test"
import { HELP_SESSION_TITLE, buildHelpPrompt, requestHelp, type HelpClient } from "./help-prompt"

function fakeClient(options: { createFails?: boolean; promptFails?: boolean } = {}) {
  const calls: unknown[] = []
  const client: HelpClient = {
    session: {
      async create(input) {
        calls.push({ create: input })
        if (options.createFails) throw new Error("server down")
        return { data: { id: "ses_1" } }
      },
      async promptAsync(input) {
        calls.push({ prompt: input })
        if (options.promptFails) throw new Error("model unavailable")
        return {}
      },
    },
  }
  return { client, calls }
}

describe("buildHelpPrompt", () => {
  test("includes the session context and asks for guidance, not a full solution", () => {
    const text = buildHelpPrompt({ round: 2, workMinutes: 25, minutesLeft: 12, companionName: "Mochi" })
    expect(text).toContain("Mochi")
    expect(text).toContain("round 2")
    expect(text).toContain("25 minute work period")
    expect(text).toContain("12 minutes left")
    expect(text).toContain("instead of writing the whole solution")
  })

  test("works without a companion", () => {
    expect(buildHelpPrompt({ round: 1, workMinutes: 50, minutesLeft: 40 })).toStartWith("I noticed")
  })
})

describe("requestHelp", () => {
  test("creates a session in the project and sends the prompt to the agent", async () => {
    const fake = fakeClient()
    expect(await requestHelp(fake.client, "/work/midterm", "help me")).toEqual({ ok: true, sessionID: "ses_1" })
    expect(fake.calls).toEqual([
      { create: { directory: "/work/midterm", title: HELP_SESSION_TITLE } },
      { prompt: { sessionID: "ses_1", directory: "/work/midterm", parts: [{ type: "text", text: "help me" }] } },
    ])
  })

  test("reports no-project without calling the server", async () => {
    const fake = fakeClient()
    expect(await requestHelp(fake.client, undefined, "help me")).toEqual({ ok: false, reason: "no-project" })
    expect(fake.calls).toEqual([])
  })

  test("reports failure when the session cannot be created", async () => {
    const fake = fakeClient({ createFails: true })
    expect(await requestHelp(fake.client, "/work/midterm", "help me")).toEqual({ ok: false, reason: "failed" })
  })

  test("reports failure when the prompt cannot be sent", async () => {
    const fake = fakeClient({ promptFails: true })
    expect(await requestHelp(fake.client, "/work/midterm", "help me")).toEqual({ ok: false, reason: "failed" })
  })
})

import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { createRoot } from "solid-js"
import type { Part } from "@opencode-ai/sdk/v2"
import type { Platform } from "@/context/platform"
import {
  createPromptSession,
  createPromptState,
  type TextPart,
} from "@/context/prompt-state"
import { extractPromptFromParts } from "@/utils/prompt"
import { createDraftStore } from "@/utils/draft-store"
import { ServerScope } from "@/utils/server-scope"
import { sendFollowupDraft } from "@/components/prompt-input/submit"

// Include empty drafts, whitespace, Unicode, and multiline text.
// Edit sequences target independently scoped sessions and can clear drafts.
// Distinct initial prefixes expose accidental sharing of prompt state.
const text = fc.oneof(
  fc.string({ maxLength: 200 }),
  fc.constantFrom(
    "",
    "  keep spaces  ",
    "line one\nline two",
    "اردو 한국어 🧪",
  ),
)

const edits = fc.array(
  fc.record({
    session: fc.integer({ min: 0, max: 1 }),
    text,
  }),
  {
    minLength: 1,
    maxLength: 12,
  },
)

// Valid PNG fixtures keep attachment tests independent of external files.
// Generate one to three attachments, including repeated image bytes,
// and filenames containing spaces or Unicode.
const screenshot = fc.record({
  url: fc.constantFrom(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkSPnPwMDAxMDAwMDAAAAPzwFnHQBNJwAAAABJRU5ErkJggg==",
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8ECDCwMDAxMDAwMDAAAAQ9gFYE0x0ggAAAABJRU5ErkJggg==",
  ),
  filename: fc.constantFrom(
    "screen.png",
    "screen shot.png",
    "لقطة.png",
    "画面.png",
  ),
})

function draft(content: string): TextPart[] {
  return [
    {
      type: "text",
      content,
      start: 0,
      end: content.length,
    },
  ]
}

function parts(content: string): Part[] {
  return [
    {
      id: "prt_text",
      sessionID: "ses_original",
      messageID: "msg_selected",
      type: "text",
      text: content,
    },
    {
      id: "prt_synthetic",
      sessionID: "ses_original",
      messageID: "msg_selected",
      type: "text",
      text: "system context ".repeat(30) + content,
      synthetic: true,
    },
    {
      id: "prt_ignored",
      sessionID: "ses_original",
      messageID: "msg_selected",
      type: "text",
      text: "ignored context ".repeat(30) + content,
      ignored: true,
    },
  ]
}

function storage() {
  const documents = new Map<string, string>()
  const writes: Promise<unknown>[] = []

  const store = createDraftStore({
    get: async (key) => documents.get(key) ?? null,
    set: async (key, value) => {
      documents.set(key, value)
    },
    remove: async (key) => {
      documents.delete(key)
    },
    putBlob: async () => {
      throw new Error(
        "Text-only draft test unexpectedly stored an image",
      )
    },
    getBlob: async () => null,
  })

  const platform: Platform = {
    platform: "web",
    openExternal: () => undefined,
    restart: async () => undefined,
    notify: async () => undefined,
    draftStore: {
      ...store,
      setItem(key, value) {
        const write = store.setItem(key, value)
        writes.push(write)
        return write
      },
    },
  }

  return {
    platform,
    flush: async () => {
      await Promise.all(writes.splice(0))
    },
  }
}

describe("P4B fork prompt properties", () => {
  // R1: Copy only messages before the selected prompt, in order.
  // Restore the prompt as an editable, unsent draft.
  // Backend properties check the history; this property checks
  // restoration and editing in the actual prompt store.
  // Kind: model/oracle.
  test(
    "R1: restore the selected user text as an editable draft",
    () => {
      fc.assert(
        fc.property(text, text, (selected, edited) => {
          createRoot((dispose) => {
            try {
              const original = createPromptState({
                prompt: "original draft",
              })
              const fork = createPromptState()
              const source = parts(selected)
              const before = structuredClone(source)

              fork.set(
                extractPromptFromParts(source),
                selected.length,
              )

              expect(fork.current()).toEqual(draft(selected))
              expect(fork.cursor()).toBe(selected.length)

              fork.set(draft(edited), edited.length)

              expect(fork.current()).toEqual(draft(edited))
              expect(original.current()).toEqual(
                draft("original draft"),
              )
              expect(source).toEqual(before)
            } finally {
              dispose()
            }
          })
        }),
        { numRuns: 100 },
      )
    },
  )

  // R3: Save the latest draft separately for each session.
  // Switching sessions or refreshing the browser must restore
  // the current session's exact unsent draft.
  // Recreating stores exercises the actual persistence implementation.
  // Kind: round-trip.
  test(
    "R3: keep each session's latest draft through edits and reload",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          text,
          text,
          edits,
          async (id, first, second, changes) => {
            const persistence = storage()

            const scopes = [
              { dir: id, id: "ses_original" },
              { dir: id, id: "ses_fork" },
            ]

            const open = () =>
              createRoot((dispose) => ({
                dispose,
                sessions: scopes.map((scope) =>
                  createPromptSession(
                    ServerScope.local,
                    scope,
                    undefined,
                    persistence.platform,
                  ),
                ),
              }))

            const expected = [
              "original: " + first,
              "fork: " + second,
            ]

            const initial = open()

            try {
              await Promise.all(
                initial.sessions.map(
                  (session) => session.ready.promise,
                ),
              )

              initial.sessions.forEach((session, index) => {
                session.set(draft(expected[index]))
              })

              for (const change of changes) {
                initial.sessions[change.session].set(
                  draft(change.text),
                )
                expected[change.session] = change.text

                initial.sessions.forEach((session, index) => {
                  expect(session.current()).toEqual(
                    draft(expected[index]),
                  )
                })
              }

              await persistence.flush()
            } finally {
              initial.dispose()
            }

            const reloaded = open()

            try {
              await Promise.all(
                reloaded.sessions.map(
                  (session) => session.ready.promise,
                ),
              )

              reloaded.sessions.forEach((session, index) => {
                expect(session.current()).toEqual(
                  draft(expected[index]),
                )
              })
            } finally {
              reloaded.dispose()
            }
          },
        ),
        { numRuns: 100 },
      )
    },
  )

  // R6: Restore the selected message's screenshot alongside editable
  // text and expose it for preview before sending. Editing and
  // submitting must retain the screenshot.
  // Check composer attachment data and the real send function's request.
  // Only network transport and optimistic UI updates are substitutes.
  // Kind: model/oracle.
  test(
    "R6: restore preview data and send the same screenshots after editing",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          text,
          text,
          fc.array(screenshot, {
            minLength: 1,
            maxLength: 3,
          }),
          async (selected, edited, screenshots) => {
            const state = createRoot((dispose) => ({
              dispose,
              prompt: createPromptState(),
            }))

            try {
              const source: Part[] = [
                ...parts(selected),
                ...screenshots.map((image, index) => ({
                  id: `prt_image_${index}`,
                  sessionID: "ses_original",
                  messageID: "msg_selected",
                  type: "file" as const,
                  mime: "image/png",
                  filename: image.filename,
                  url: image.url,
                })),
              ]

              const before = structuredClone(source)

              state.prompt.set(extractPromptFromParts(source))

              const images = state.prompt
                .current()
                .filter((part) => part.type === "image")

              expect(
                state.prompt
                  .current()
                  .filter((part) => part.type === "text"),
              ).toEqual(draft(selected))

              expect(images).toHaveLength(screenshots.length)

              images.forEach((image, index) => {
                expect(image.filename).toBe(
                  screenshots[index].filename,
                )
                expect(image.mime).toBe("image/png")
                expect(image.blob.url).toBe(
                  screenshots[index].url,
                )
              })

              const replacement = "Edited: " + edited

              state.prompt.set([
                ...draft(replacement),
                ...images,
              ])

              type Input = Parameters<
                typeof sendFollowupDraft
              >[0]

              type Request = Parameters<
                Input["api"]["prompt"]
              >[0]

              const sent: Request[] = []

              const ok = await sendFollowupDraft({
                api: {
                  prompt: async (request: Request) => {
                    sent.push(request)
                  },
                } as unknown as Input["api"],

                serverSync: {} as Input["serverSync"],

                sync: {
                  data: { command: [] },
                  session: {
                    optimistic: {
                      add: () => undefined,
                      remove: () => undefined,
                    },
                  },
                } as unknown as Input["sync"],

                draft: {
                  sessionID: "ses_fork",
                  sessionDirectory: "/p4b",
                  prompt: state.prompt.current(),
                  context: [],
                  agent: "build",
                  model: {
                    providerID: "p4b",
                    modelID: "fixture",
                  },
                },
              })

              expect(ok).toBe(true)
              expect(sent).toHaveLength(1)
              expect(sent[0].sessionID).toBe("ses_fork")
              expect(sent[0].text).toBe(replacement)

              expect(
                sent[0].files?.map((file) => ({
                  name: file.name,
                  uri: file.uri,
                })),
              ).toEqual(
                screenshots.map((image) => ({
                  name: image.filename,
                  uri: image.url,
                })),
              )

              expect(source).toEqual(before)
            } finally {
              state.dispose()
            }
          },
        ),
        { numRuns: 100 },
      )
    },
  )
})
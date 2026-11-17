import { describe, expect } from "bun:test"
import fc from "fast-check"
import { Effect, Layer } from "effect"
import { Model } from "@opencode-ai/schema/model"
import { Provider } from "@opencode-ai/schema/provider"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Session } from "@/session/session"
import { MessageID, PartID, type SessionID } from "@/session/schema"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { EventV2Bridge } from "@/event-v2-bridge"
import { InstanceStore } from "@/project/instance-store"
import { InstanceBootstrap } from "@/project/bootstrap"
import { testEffect } from "../lib/effect"

const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([
      Session.node,
      EventV2Bridge.node,
      SessionProjector.node,
      CrossSpawnSpawner.node,
      InstanceStore.node,
    ]),
    [
      [
        RuntimeFlags.node,
        RuntimeFlags.layer({ experimentalWorkspaces: false }),
      ],
      [
        InstanceBootstrap.node,
        Layer.succeed(InstanceBootstrap.Service, { run: Effect.void }),
      ],
    ],
  ),
)

// Short conversations keep database-backed trials fast.
// First, last, and random fork points exercise empty and non-empty prefixes.
// Repeated prompt text tests selection by message identity.
// Reversed IDs expose bugs that confuse ID order with chronological order.
// Explicit Unicode, whitespace, and multiline cases complement generated text.
const text = fc.oneof(
  fc.string({ minLength: 1, maxLength: 120 }),
  fc.constantFrom(
    "Run the tests again",
    "Line one\nLine two",
    "  keep spaces  ",
    "اردو 한국어 🧪",
  ),
)

const turn = fc.record({
  prompt: text,
  reply: text,
})

const scenario = fc
  .array(turn, { minLength: 1, maxLength: 8 })
  .chain((turns) =>
    fc.record({
      turns: fc.constant(turns),
      selected: fc.oneof(
        fc.constant(0),
        fc.constant(turns.length - 1),
        fc.integer({ min: 0, max: turns.length - 1 }),
      ),
      reverseIDs: fc.boolean(),
      later: fc.array(turn, { minLength: 1, maxLength: 3 }),
      edit: text,
      next: turn,
    }),
  )

function create(session: Session.Interface) {
  return Effect.acquireRelease(
    session.create({ title: "P4B fork property" }),
    (info) => session.remove(info.id).pipe(Effect.ignore),
  )
}

function fork(
  session: Session.Interface,
  sessionID: SessionID,
  messageID: MessageID,
) {
  return Effect.acquireRelease(
    session.fork({ sessionID, messageID }),
    (info) => session.remove(info.id).pipe(Effect.ignore),
  )
}

function append(
  session: Session.Interface,
  sessionID: SessionID,
  turns: { prompt: string; reply: string }[],
  offset = 0,
  reverseIDs = false,
) {
  return Effect.gen(function* () {
    const ids = Array.from(
      { length: turns.length * 2 },
      () => MessageID.ascending(),
    )

    if (reverseIDs) ids.reverse()

    const model = {
      providerID: Provider.ID.make("p4b"),
      modelID: Model.ID.make("fixture"),
    }

    for (const [index, item] of turns.entries()) {
      const user = ids[index * 2]!
      const assistant = ids[index * 2 + 1]!
      const created = offset + index * 2 + 1

      yield* session.updateMessage({
        id: user,
        sessionID,
        role: "user",
        time: { created },
        agent: "build",
        model,
      })

      yield* session.updatePart({
        id: PartID.ascending(),
        sessionID,
        messageID: user,
        type: "text",
        text: item.prompt,
      })

      yield* session.updateMessage({
        id: assistant,
        sessionID,
        role: "assistant",
        parentID: user,
        time: {
          created: created + 1,
          completed: created + 1,
        },
        agent: "build",
        mode: "build",
        modelID: model.modelID,
        providerID: model.providerID,
        path: {
          cwd: "/p4b",
          root: "/p4b",
        },
        cost: 0,
        tokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cache: {
            read: 0,
            write: 0,
          },
        },
        finish: "stop",
      })

      yield* session.updatePart({
        id: PartID.ascending(),
        sessionID,
        messageID: assistant,
        type: "text",
        text: item.reply,
      })
    }

    return ids
  })
}

function content(messages: SessionV1.WithParts[]) {
  return messages.map((message) => ({
    role: message.info.role,
    text: message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(""),
  }))
}

function expected(turns: { prompt: string; reply: string }[]) {
  return turns.flatMap((item) => [
    { role: "user" as const, text: item.prompt },
    { role: "assistant" as const, text: item.reply },
  ])
}

function ownership(
  messages: SessionV1.WithParts[],
  sessionID: SessionID,
) {
  const ids = new Set(
    messages.map((message) => message.info.id),
  )

  expect(ids.size).toBe(messages.length)

  for (const message of messages) {
    expect(message.info.sessionID).toBe(sessionID)

    for (const part of message.parts) {
      expect(part.sessionID).toBe(sessionID)
      expect(part.messageID).toBe(message.info.id)
    }

    if (message.info.role === "assistant") {
      expect(ids.has(message.info.parentID)).toBe(true)
    }
  }
}

describe("P4B conversation forking properties", () => {
  // R1: Copy only messages before the selected prompt, in order.
  // Restore the prompt as an editable, unsent draft.
  // This property covers the backend prefix; app properties must
  // additionally cover restoration of the selected draft.
  // Kind: model/oracle.
  it.instance(
    "R1: fork history equals exactly the preceding conversation",
    () =>
      Effect.gen(function* () {
        const session = yield* Session.Service
        const run = Effect.runPromiseWith(
          yield* Effect.context<Session.Service>(),
        )

        yield* Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(scenario, (input) =>
              run(
                Effect.scoped(
                  Effect.gen(function* () {
                    const original = yield* create(session)

                    const ids = yield* append(
                      session,
                      original.id,
                      input.turns,
                      0,
                      input.reverseIDs,
                    )

                    const branch = yield* fork(
                      session,
                      original.id,
                      ids[input.selected * 2]!,
                    )

                    const copied = yield* session.messages({
                      sessionID: branch.id,
                    })

                    expect(content(copied)).toEqual(
                      expected(input.turns.slice(0, input.selected)),
                    )

                    expect(branch.id).not.toBe(original.id)

                    expect(
                      copied.every(
                        (message) => !ids.includes(message.info.id),
                      ),
                    ).toBe(true)

                    ownership(copied, branch.id)
                  }),
                ),
              ),
            ),
            { numRuns: 100 },
          ),
        )
      }),
    { timeout: 60000 },
  )

  // R1: Copy only messages before the selected prompt, in order.
  // Later exchanges must have no effect on the same fork point
  // (C-21, O-21, O-23).
  // Kind: metamorphic.
  it.instance(
    "R1: appending later exchanges does not change the fork prefix",
    () =>
      Effect.gen(function* () {
        const session = yield* Session.Service
        const run = Effect.runPromiseWith(
          yield* Effect.context<Session.Service>(),
        )

        yield* Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(scenario, (input) =>
              run(
                Effect.scoped(
                  Effect.gen(function* () {
                    const original = yield* create(session)

                    const ids = yield* append(
                      session,
                      original.id,
                      input.turns,
                      0,
                      input.reverseIDs,
                    )

                    const first = yield* fork(
                      session,
                      original.id,
                      ids[input.selected * 2]!,
                    )

                    const before = yield* session.messages({
                      sessionID: first.id,
                    })

                    yield* append(
                      session,
                      original.id,
                      input.later,
                      input.turns.length * 2,
                      input.reverseIDs,
                    )

                    const second = yield* fork(
                      session,
                      original.id,
                      ids[input.selected * 2]!,
                    )

                    const after = yield* session.messages({
                      sessionID: second.id,
                    })

                    expect(content(before)).toEqual(
                      expected(input.turns.slice(0, input.selected)),
                    )

                    expect(content(after)).toEqual(content(before))

                    expect(
                      new Set([
                        original.id,
                        first.id,
                        second.id,
                      ]).size,
                    ).toBe(3)

                    expect(
                      yield* session.messages({
                        sessionID: first.id,
                      }),
                    ).toEqual(before)

                    ownership(after, second.id)
                  }),
                ),
              ),
            ),
            { numRuns: 100 },
          ),
        )
      }),
    { timeout: 60000 },
  )

  // R2: Keep the original history independent and preserve the original
  // conversation when users edit or send prompts in a fork.
  // Kind: invariant.
  it.instance(
    "R2: editing and extending a fork preserves original messages",
    () =>
      Effect.gen(function* () {
        const session = yield* Session.Service
        const run = Effect.runPromiseWith(
          yield* Effect.context<Session.Service>(),
        )

        yield* Effect.promise(() =>
          fc.assert(
            fc.asyncProperty(scenario, (input) =>
              run(
                Effect.scoped(
                  Effect.gen(function* () {
                    const original = yield* create(session)

                    const ids = yield* append(
                      session,
                      original.id,
                      input.turns,
                      0,
                      input.reverseIDs,
                    )

                    const before = structuredClone(
                      yield* session.messages({
                        sessionID: original.id,
                      }),
                    )

                    const branch = yield* fork(
                      session,
                      original.id,
                      ids[input.selected * 2]!,
                    )

                    const copied = yield* session.messages({
                      sessionID: branch.id,
                    })

                    const part = copied[0]?.parts.find(
                      (part) => part.type === "text",
                    )

                    if (part?.type === "text") {
                      yield* session.updatePart({
                        ...part,
                        text: input.edit,
                      })
                    }

                    const sent = yield* append(
                      session,
                      branch.id,
                      [input.next],
                      input.turns.length * 2,
                    )

                    const after = yield* session.messages({
                      sessionID: original.id,
                    })

                    const updated = yield* session.messages({
                      sessionID: branch.id,
                    })

                    expect(after).toEqual(before)

                    expect(
                      after.every(
                        (message) => !sent.includes(message.info.id),
                      ),
                    ).toBe(true)

                    expect(content(updated).slice(-2)).toEqual(
                      expected([input.next]),
                    )

                    if (part) {
                      expect(content(updated)[0]?.text).toBe(
                        input.edit,
                      )
                    }

                    ownership(updated, branch.id)
                  }),
                ),
              ),
            ),
            { numRuns: 100 },
          ),
        )
      }),
    { timeout: 60000 },
  )
})
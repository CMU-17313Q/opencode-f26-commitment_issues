import { expect, test } from "bun:test"
import path from "path"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer } from "effect"
import { Agent } from "../../src/agent/agent"
import { Command } from "../../src/command"
import { Config } from "../../src/config/config"
import { InstanceState } from "../../src/effect/instance-state"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { MCP } from "../../src/mcp"
import { LearnFlowTool } from "../../src/tool/learn-flow"
import { ToolRegistry } from "../../src/tool/registry"
import PROMPT_LEARN_FLOW from "../../src/command/template/learn-flow.txt"
import { TestConfig } from "../fixture/config"
import { testInstanceStoreLayer } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const mcp = Layer.mock(MCP.Service, { prompts: () => Effect.succeed({}) })

const it = testEffect(Layer.mergeAll(LayerNode.compile(Command.node, [[MCP.node, mcp]]), testInstanceStoreLayer))

const withRegistry = testEffect(
  LayerNode.compile(LayerNode.group([ToolRegistry.node, Agent.node]), [
    [
      Config.node,
      TestConfig.layer({
        directories: () => InstanceState.directory.pipe(Effect.map((dir) => [path.join(dir, ".opencode")])),
      }),
    ],
    [RuntimeFlags.node, RuntimeFlags.layer()],
  ]),
)

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

it.instance("learn-flow appears in the command list and can be retrieved individually", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const list = yield* commands.list()
    expect(list.some((c) => c.name === Command.Default.LEARN_FLOW)).toBe(true)
    expect(yield* commands.get(Command.Default.LEARN_FLOW)).toBeDefined()
  }),
)

it.instance("learn-flow has the expected name, description, and source", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnFlow = yield* commands.get(Command.Default.LEARN_FLOW)
    expect(Command.Default.LEARN_FLOW).toBe("learn-flow")
    expect(learnFlow?.name).toBe("learn-flow")
    expect(learnFlow?.description).toBe("draw a flowchart of a function and explain it")
    expect(learnFlow?.source).toBe("command")
  }),
)

it.instance("learn-flow runs inline (not as a subtask) with no agent or model override", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnFlow = yield* commands.get(Command.Default.LEARN_FLOW)
    expect(learnFlow?.subtask).toBeUndefined()
    expect(learnFlow?.agent).toBeUndefined()
    expect(learnFlow?.model).toBeUndefined()
  }),
)

// ---------------------------------------------------------------------------
// Template wiring
// ---------------------------------------------------------------------------

it.instance("learn-flow template is exactly the contents of learn-flow.txt", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnFlow = yield* commands.get(Command.Default.LEARN_FLOW)
    const template = yield* Effect.promise(() => Promise.resolve(learnFlow?.template))
    expect(template).toBe(PROMPT_LEARN_FLOW)
  }),
)

it.instance("learn-flow hints include $ARGUMENTS", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const learnFlow = yield* commands.get(Command.Default.LEARN_FLOW)
    expect(learnFlow?.hints).toContain("$ARGUMENTS")
  }),
)

// ---------------------------------------------------------------------------
// Template content
// ---------------------------------------------------------------------------

test("learn-flow template names the learn_flow tool and its filePath and functionName parameters", () => {
  expect(PROMPT_LEARN_FLOW).toContain("`learn_flow`")
  expect(PROMPT_LEARN_FLOW).toContain("`filePath`")
  expect(PROMPT_LEARN_FLOW).toContain("`functionName`")
})

test("learn-flow template asks for the file and function when the input is missing or unclear", () => {
  expect(PROMPT_LEARN_FLOW).toContain("ask the student which file and which function they mean")
})

test("learn-flow template shows the diagram in a code block exactly as the tool returned it", () => {
  expect(PROMPT_LEARN_FLOW).toContain("exactly as the `learn_flow` tool returned it, in a code block")
  expect(PROMPT_LEARN_FLOW).toContain("Do not redraw it")
})

test("learn-flow template tells the model not to rewrite code or edit files", () => {
  expect(PROMPT_LEARN_FLOW).toContain("Do not rewrite, refactor, or suggest replacement code")
  expect(PROMPT_LEARN_FLOW).toContain("Do not edit any files.")
})

test("learn-flow template handles tool failure messages without inventing a diagram", () => {
  expect(PROMPT_LEARN_FLOW).toContain("If the tool returns a message instead of a diagram")
  expect(PROMPT_LEARN_FLOW).toContain("not found")
  expect(PROMPT_LEARN_FLOW).toContain("Do not invent a diagram.")
})

test("learn-flow template tells the model to be honest about unsupported boxes", () => {
  expect(PROMPT_LEARN_FLOW).toContain("`unsupported`")
  expect(PROMPT_LEARN_FLOW).toContain("the tool could not draw that part")
})

test("learn-flow template explains decisions, paths, loops and concepts", () => {
  expect(PROMPT_LEARN_FLOW).toContain("**What each decision checks**")
  expect(PROMPT_LEARN_FLOW).toContain("**Where each path leads**")
  expect(PROMPT_LEARN_FLOW).toContain("**Where loops repeat**")
  expect(PROMPT_LEARN_FLOW).toContain("early return")
  expect(PROMPT_LEARN_FLOW).toContain("recursion")
})

// ---------------------------------------------------------------------------
// Regression
// ---------------------------------------------------------------------------

it.instance("init, review, learn-recap, learn-quiz, learn-test and learn-flow are all registered with no duplicates", () =>
  Effect.gen(function* () {
    const commands = yield* Command.Service
    const names = (yield* commands.list()).map((c) => c.name)

    expect(names).toEqual(
      expect.arrayContaining([
        Command.Default.INIT,
        Command.Default.REVIEW,
        Command.Default.LEARN_RECAP,
        Command.Default.LEARN_QUIZ,
        Command.Default.LEARN_TEST,
        Command.Default.LEARN_FLOW,
      ]),
    )
    expect(new Set(names).size).toBe(names.length)
  }),
)

withRegistry.instance("the tool name in the learn-flow template matches the id the tool is registered under", () =>
  Effect.gen(function* () {
    const registry = yield* ToolRegistry.Service
    const ids = yield* registry.ids()

    expect(LearnFlowTool.id).toBe("learn_flow")
    expect(ids).toContain(LearnFlowTool.id)
    expect(PROMPT_LEARN_FLOW).toContain(`\`${LearnFlowTool.id}\``)
  }),
)

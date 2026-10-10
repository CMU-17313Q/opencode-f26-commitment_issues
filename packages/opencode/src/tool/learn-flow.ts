import path from "path"
import { Effect, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { extractGraph } from "../command/learn-flow/extract"
import { renderFlowchart } from "../command/learn-flow/render"
import { assertExternalDirectoryEffect } from "./external-directory"
import DESCRIPTION from "./learn-flow.txt"
import * as Tool from "./tool"

export const Parameters = Schema.Struct({
  filePath: Schema.String.annotate({
    description: "The path to the TypeScript or JavaScript file, absolute or relative to the project directory",
  }),
  functionName: Schema.String.annotate({
    description: "The name of the function to draw: a function declaration, a const arrow function, or a class method",
  }),
})

export const LearnFlowTool = Tool.define(
  "learn_flow",
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const instance = yield* InstanceState.context
          let filepath = params.filePath
          if (!path.isAbsolute(filepath)) filepath = path.resolve(instance.directory, filepath)
          if (process.platform === "win32") filepath = FSUtil.normalizePath(filepath)
          const title = path.relative(instance.worktree, filepath)

          yield* assertExternalDirectoryEffect(ctx, filepath, {
            bypass: Boolean(ctx.extra?.["bypassCwdCheck"]),
            kind: "file",
          })

          yield* ctx.ask({
            permission: "read",
            patterns: [title],
            always: ["*"],
            metadata: {},
          })

          // A missing, unreadable or non-file path is reported as output rather than failing the tool call.
          const source = yield* fs.readFileStringSafe(filepath).pipe(Effect.catch(() => Effect.succeed(undefined)))
          if (source === undefined) {
            return { title, output: `File not found or not readable: ${filepath}`, metadata: { ok: false } }
          }

          const result = yield* Effect.promise(() => extractGraph(source, params.functionName))
          if (!result.ok) return { title, output: result.error, metadata: { ok: false } }

          return { title, output: renderFlowchart(result.graph), metadata: { ok: true } }
        }).pipe(Effect.orDie),
    }
  }),
)

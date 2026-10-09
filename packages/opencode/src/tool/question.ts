import { Effect, Schema } from "effect"
import * as Tool from "./tool"
import { Question } from "../question"
import DESCRIPTION from "./question.txt"

// Quizzes give each question a hint. It is passed on at the end of the question text, after a blank line and
// "Hint:", where the TUI quiz view hides it until the user asks; this keeps the public question schema unchanged.
const Prompt = Schema.Struct({
  ...Question.Prompt.fields,
  hint: Schema.optional(Schema.String).annotate({
    description: "Optional hint the user can reveal before answering. Must not give away the answer",
  }),
})

export const Parameters = Schema.Struct({
  questions: Schema.mutable(Schema.Array(Prompt)).annotate({ description: "Questions to ask" }),
})

type Metadata = {
  answers: ReadonlyArray<Question.Answer>
}

export const QuestionTool = Tool.define<typeof Parameters, Metadata, Question.Service>(
  "question",
  Effect.gen(function* () {
    const question = yield* Question.Service

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        Effect.gen(function* () {
          const answers = yield* question.ask({
            sessionID: ctx.sessionID,
            questions: params.questions.map(({ hint, ...item }) =>
              hint ? { ...item, question: `${item.question}\n\nHint: ${hint}` } : item,
            ),
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })

          const formatted = params.questions
            .map((q, i) => `"${q.question}"="${answers[i]?.length ? answers[i].join(", ") : "Unanswered"}"`)
            .join(", ")

          return {
            title: `Asked ${params.questions.length} question${params.questions.length > 1 ? "s" : ""}`,
            output: `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`,
            metadata: {
              answers,
            },
          }
        }).pipe(Effect.orDie),
    }
  }),
)

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
  // A quiz stores the correct option of a multiple choice question when it asks it. Like the hint, it never reaches
  // the client, and the user's pick is graded against it in code, so the verdict cannot be swayed by seeing the pick.
  answer: Schema.optional(Schema.String).annotate({
    description:
      "Quiz multiple choice questions only: the exact label of the one correct option. Hidden from the user; their pick is graded against it",
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
            questions: params.questions.map(({ hint, answer, ...item }) =>
              hint ? { ...item, question: `${item.question}\n\nHint: ${hint}` } : item,
            ),
            tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
          })

          const formatted = params.questions
            .map((q, i) => `"${q.question}"="${answers[i]?.length ? answers[i].join(", ") : "Unanswered"}"`)
            .join(", ")

          // Only questions that stored an answer key are graded, so questions asked outside a quiz are unaffected.
          const grades = params.questions.flatMap((item, i) => {
            if (item.answer === undefined) return []
            const key = item.options.find((option) => option.label.trim() === item.answer?.trim())?.label
            const pick = answers[i] ?? []
            if (key === undefined || item.multiple)
              return [`Question ${i + 1}: Ungraded. No valid answer key was stored.`]
            if (pick.length === 0) return [`Question ${i + 1}: Skipped. The answer is "${key}".`]
            if (pick.length === 1 && pick[0] === key) return [`Question ${i + 1}: Correct`]
            return [`Question ${i + 1}: Incorrect. The answer is "${key}".`]
          })

          return {
            title: `Asked ${params.questions.length} question${params.questions.length > 1 ? "s" : ""}`,
            output: [
              `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`,
              ...(grades.length > 0
                ? [
                    "",
                    "Multiple choice grades, checked against the answer key stored when each question was asked. Use these verdicts as given:",
                    ...grades,
                  ]
                : []),
            ].join("\n"),
            metadata: {
              answers,
            },
          }
        }).pipe(Effect.orDie),
    }
  }),
)

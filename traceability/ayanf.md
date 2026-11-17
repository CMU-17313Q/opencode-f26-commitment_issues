# Traceability: Ayan Fatima (ayanf)

**Target feature:** OpenCode conversation forking.

Main source files:

- [use-session-commands.tsx](../packages/app/src/pages/session/use-session-commands.tsx): registers the fork command.
- [dialog-fork.tsx](../packages/app/src/components/dialog-fork.tsx): selects the fork point, requests the fork, and restores the draft.
- [session.ts](../packages/opencode/src/session/session.ts): creates the fork and copies preceding messages.
- [utils/prompt.ts](../packages/app/src/utils/prompt.ts): reconstructs the selected prompt and attachments.
- [context/prompt.tsx](../packages/app/src/context/prompt.tsx): connects drafts to individual sessions.
- [prompt-state.ts](../packages/app/src/context/prompt-state.ts): manages prompt edits and session-scoped persistence.

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4B? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 | C-8, S-8, S-10 expect earlier history and an editable prompt. C-21, O-21, O-23 expect later exchanges to have no effect on the same fork point. | Copy only messages before the selected prompt, in order. Restore the prompt as an editable, unsent draft. | Fork the same message before and after adding a later exchange. Both forks contain exactly the same preceding messages and the same unsent draft, but have distinct session IDs. | No | Exact preceding history (model/oracle); unchanged prefix after appending exchanges (metamorphic); restored text remains editable (model/oracle). | [Backend R1 properties](../packages/opencode/test/session/fork.property.test.ts); [App R1 property](../packages/app/test-browser/fork-prompt.property.test.ts). |
| R2 | C-12, S-16, S-19, O-14, O-16, O-32 expect the original conversation to remain intact. | Keep the original history independent and preserve the original conversation when users edit or send prompts in a fork. | Edit and send a prompt in the fork. The original retains its exact message content and order. The new exchange appears only in the fork. | No | Original messages remain unchanged after fork edits and a new exchange (invariant). | [Backend R2 property](../packages/opencode/test/session/fork.property.test.ts). |
| R3 | C-26, C-27, C-29, S-28, O-26, O-28 expect the latest unsent edit to survive switching and refreshing. C-29 suggests different drafts in each chat. | Save the latest draft separately for each session. Switching sessions or refreshing the browser must restore the current session's exact unsent draft. | Enter different drafts in the original and fork. Switch between them and reload each. Both restore their exact drafts without sending them. | No | Separate session drafts retain their latest edits after persistence and store recreation (round-trip). | [App R3 property](../packages/app/test-browser/fork-prompt.property.test.ts). |
| R4 | C-6, C-10, C-23, C-33 identify unclear fork boundaries and repeated prompts. O-7, O-12 show uncertainty about what selection keeps. | Label prompts by turn number and explain what gets copied and what becomes a draft. The fork point must be clear before selection. | Two identical prompts show distinct, correct turn numbers. The explanation appears before selection. Selecting the later prompt copies exactly the preceding history and restores it as an unsent draft. | No | Not selected for property coverage in P4B. | Not selected. |
| R5 | S-25, S-26, S-31, S-32 ask for saved forks and visible parentage. C-31, O-30 want recognizable previews. | List saved forks under their immediate parent. Preview must show the first prompt sent in the fork, or the source prompt if none was sent. | After closing and reloading two same-titled siblings and a nested fork, each appears under its immediate parent. Previews show the first newly sent prompt or the source prompt. Each entry opens the correct session. | No | Not selected for property coverage in P4B. | Not selected. |
| R6 | O-4, O-33 explain how screenshots supply context the text relies on. | When the selected message contains a screenshot, the fork must restore the image as an attachment alongside the editable text and show it in the composer before sending. | Fork a prompt with a screenshot. The composer shows the original text and image. Edit and send the draft, then verify that the outgoing message contains the edited text and the same image. | No | Restored composer attachment data and the outgoing submission retain the original screenshot after text edits (model/oracle). | [App R6 property](../packages/app/test-browser/fork-prompt.property.test.ts). |

Properties written or suggested by opencode or another AI tool: I used Codex to review and enhance the properties, but all were based on insights from the interviews.

## Requirement changes

All six requirements are kept because they describe concrete behavior that can be implemented and checked through session history, draft persistence, picker content, sidebar relationships, and attachment handling. They do not conflict or depend on judging AI-generated answers; R4 and R5 remain reviewed requirements outside this submission's selected property coverage.

## Generators and test boundaries

- Backend generators vary conversation length, fork position, text, later exchanges, and message-ID ordering. Cases include empty copied prefixes, repeated prompt text, Unicode, whitespace, and multiline content.
- App generators vary draft text, session-specific edit sequences, clearing drafts, and one to three valid PNG attachments with varied filenames.
- Backend properties use the real session service and database. App properties use production prompt restoration, prompt state, persistence, and submission code, with controlled storage and a captured network transport.
- Generated replies are fixed test data. Assertions check conversation and draft state, rather than the quality of AI-generated answers.

## Run, triage, and fix

All six properties pass locally with 100 generated cases per property. No failing property or shrunk counterexample was reported, so no production-code fix or requirement revision was needed.

Local validation:

- Backend properties: 3 passed, 0 failed.
- App properties: 3 passed, 0 failed.
- `bun typecheck` passed in both `packages/opencode` and `packages/app`.

## Continuous integration

[P4B Ayan Properties](../.github/workflows/p4b-ayanf-properties.yml) runs both property files on pull requests to `main` and prints each property result. Both affected packages are also listed in `turbo.json` for the repository's existing unit-test workflow.
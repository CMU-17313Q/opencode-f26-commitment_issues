# Traceability: Ayan Fatima (ayanf)

**Target feature:** OpenCode conversation forking.

Main source files:

- [use-session-commands.tsx](../packages/app/src/pages/session/use-session-commands.tsx): registers the fork command.
- [dialog-fork.tsx](../packages/app/src/components/dialog-fork.tsx): selects the fork point, requests the fork, and restores the draft.
- [session.ts](../packages/opencode/src/session/session.ts): creates the fork and copies preceding messages.
- [utils/prompt.ts](../packages/app/src/utils/prompt.ts): reconstructs the selected prompt and attachments.
- [context/prompt.tsx](../packages/app/src/context/prompt.tsx): connects drafts to individual sessions.

## Requirements

| ID | Interview evidence | Requirement | Acceptance Criteria | Changed in P4B? | Property (kind) | Test |
|---|---|---|---|---|---|---|
| R1 | C-8, S-8, S-10 expect earlier history and an editable selected prompt. C-21, O-21, O-23 expect later exchanges to have no effect on the same fork point. | Copy only messages before the selected prompt, in order. Restore the prompt as an editable, unsent draft. | Fork the same message before and after adding a later exchange. Both forks contain exactly the same preceding messages and the same unsent draft, but have distinct session IDs. | No | Planned: compare copied history and restored draft with an independent expected result (model/oracle); append later exchanges and verify the fork's initial content remains unchanged (metamorphic). | Pending implementation. |
| R2 | C-12, S-16, S-19, O-14, O-16, O-32 expect to return to the original and see the conversation they left. | Keep the original history independent and preserve the original conversation when users edit or send prompts in a fork. | Edit and send a prompt in the fork. The original retains its exact message content and order. The new exchange appears only in the fork. | No | Planned: original message content and order remain unchanged after edits and submissions in a fork (invariant). | Pending implementation. |
| R3 | C-26, C-27, C-29, S-28, O-26, O-28 expect the latest unsent edit to survive switching and refreshing. C-29 suggests testing with a different draft in each chat. | Save the latest draft separately for each session. Switching sessions or refreshing the browser must restore the current session's exact unsent draft. | Enter different drafts in the original and fork. Switch between them and reload each. Both restore their exact drafts without sending them. | No | Planned: save distinct session drafts, switch sessions, reload persisted state, and recover each latest draft exactly (round-trip). | Pending implementation. |
| R4 | C-6, C-10, C-23, C-33 show confusion about where history stops and difficulty distinguishing repeated prompts. O-7, O-12 show that the selected exchange was initially interpreted as the last one kept. | Label prompts by turn number and explain what gets copied and what becomes a draft. The fork point must be clear before selection. | Given two user messages with identical text at different turns, the picker displays both with their correct, distinct turn numbers. The explanation is visible before selection. Choosing the later prompt copies exactly the history before it and restores it as an unsent draft. | No | Not selected for property coverage in P4B. | — |
| R5 | S-25, S-26, S-31, S-32 ask for saved forks and visible parentage. C-31, O-30 want previews that distinguish branches by what users were trying. | List saved forks under their immediate parent. Preview must show the first prompt sent in the fork, or the source prompt if none was sent. | After closing and reloading two same-titled sibling forks and one nested fork, each appears under its correct parent. A fork with a new prompt previews that first prompt, and an unsent fork previews its source prompt. Each entry opens the correct session. | No | Not selected for property coverage in P4B. | — |
| R6 | O-4, O-33 explain how screenshots supply context the prompt text relies on. | When the selected message contains a screenshot, the fork must restore the image as an attachment alongside the editable text and show it in the composer before sending. | Fork a prompt with a screenshot. The composer shows the original text and image. Edit and send the draft, then verify that the outgoing message contains the edited text and the same image. | No | Planned: compare restored composer content and outgoing message content against the selected text, screenshot, and subsequent text edit (model/oracle). | Pending implementation. |

Properties written or suggested by opencode or another AI tool: I used Codex to review and enhance the properties, but all were based on insights from the interviews.

## Requirement changes

All six requirements are kept because they describe concrete behavior that can be implemented and checked through session history, draft persistence, picker content, sidebar relationships, and attachment handling. They do not conflict or depend on judging AI-generated answers; requirements needing additional implementation remain valid requirements.

## Generators and test boundaries

- Backend generators vary conversation length, fork position, text, later exchanges, and message-ID ordering. Cases include empty copied prefixes, repeated prompt text, Unicode, whitespace, and multiline content.
- App generators vary draft text, session-specific edit sequences, clearing drafts, and 1-3 valid PNG attachments with varied filenames.
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
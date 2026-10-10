<!--
HOW TO USE THIS FILE (delete this comment block before submitting)

Each section below is prefilled with the owner, issue, PR and acceptance criteria.
Fill in every <placeholder> in YOUR section only. Delete the "Hint:" lines when done.
Do not edit other people's sections. Follow your own user-test steps on main, then fill in the last line.
-->

# User Guide: Learning Companion

The Learning Companion helps students understand code written with opencode instead of just accepting it. It adds commands that explain code changes, explain tests, and ask reflection questions, plus the reusable prompt templates behind them.

## Running the app

You need [Bun](https://bun.sh) and at least one project added in opencode. From the repo root:

```bash
bun install
bun dev serve --port 4096                   # terminal 1: opencode server
cd packages/app && bun dev -- --port 4444   # terminal 2: web app
```

Open <http://localhost:4444>. <Command owners: say here, or in your own section, where to type `/learn-recap`, `/learn-quiz` and `/learn-test`.>

---

## Feature: Test Explanation prompt template

**Owner:** Noor Al-Kuwari · **Issue:** #2 · **PR:** #8

> As a student writing tests in a new language or library, I want opencode to explain what each test does in plain language, so that I can understand the testing logic and become more confident writing tests independently in the future.

This is the prompt that the `/learn-test` command (#6) sends to the AI. We first called the command `/learn-tests`, but it was merged as `/learn-test`. PR #23 connected it to this prompt.

### How to use it

1. The prompt is saved in `packages/opencode/src/command/template/test-explanation.txt`. The `/learn-test` command loads it from there (see `packages/opencode/src/command/index.ts`), so the prompt is only written once.
2. In a chat, type `/learn-test` and then the test you want explained. This can be a file path, a test name, or a test you paste in. If you type nothing after it, the AI explains the test you were just talking about, or asks which test you mean.
3. The AI gives a short explanation in this order: what the test is for, why it matters, how it checks that, the testing ideas it uses, and what it doesn't catch. It ends with one question to check that you understood. It does not rewrite the test or change any files.

### How to user-test it (about 5 minutes)

Open this repo as a project in opencode and start a new chat. A good test file to try is `packages/app/src/pages/home/focus-session/controller/presets.test.ts`.

| # | Do this | You should see |
|---|---------|----------------|
| 1 | Run `/learn-test packages/app/src/pages/home/focus-session/controller/presets.test.ts` | It explains why the tests matter (for example, what goes wrong for a user if bad times are accepted), not just what each line does |
| 2 | Read the first part of the answer | It starts by saying what the tests are for |
| 3 | Look at the answer and your files | No new or "fixed" test code, and no files changed |
| 4 | Run `/learn-test` and paste a short pytest test | It says the test uses pytest, and the explanation still makes sense |
| 5 | Run `/learn-test` with nothing after it in a new chat | It asks which test you mean |

### Automated tests

**Where they are:** `packages/opencode/test/command/test-explanation-template.test.ts` and `packages/opencode/test/command/learn-tests.test.ts` (2 files, 9 tests).

**How to run them**, from `packages/opencode`:

```bash
bun test test/command/test-explanation-template.test.ts test/command/learn-tests.test.ts
```

They also run in CI (GitHub Actions) on every PR.

**What they check:**

| Acceptance criterion (#2) | Test file / test name |
|---------------------------|-----------------------|
| OpenCode explains why the test matters, not only what each line does | `test-explanation-template.test.ts` / "asks for the overall purpose and why the test matters", "teaches instead of translating line by line" |
| Avoids unnecessary replacement code when the student asks for an explanation | `test-explanation-template.test.ts` / "does not offer replacement code unless the student asks" |
| The template asks the model to explain the overall purpose of the test | `test-explanation-template.test.ts` / "asks for the overall purpose and why the test matters" |
| The prompt works across different testing languages/frameworks | `test-explanation-template.test.ts` / "detects the framework instead of assuming one" |
| *(Extra)* The prompt receives the test through `$ARGUMENTS`, and `/learn-test` uses this prompt | `test-explanation-template.test.ts` / "takes the tests to explain through $ARGUMENTS"; `learn-tests.test.ts` / "uses the Test Explanation prompt template", "takes the selected tests as $ARGUMENTS" |

### Why these tests are enough

- Every acceptance criterion has at least one test (see the table).
- The tests use the real prompt file and the real command code, not copies. `learn-tests.test.ts` loads the actual list of commands and checks that `/learn-test` uses this prompt.
- They also check a few edge cases:
  - `$ARGUMENTS` is the only placeholder in the prompt, so no extra arguments show up by mistake.
  - The prompt gives examples from several test frameworks (JUnit, pytest, Jest, RSpec), so it doesn't assume one.
  - Adding the command didn't change the existing `/init` and `/review` commands.
- The tests can only check what the prompt *tells* the AI to do. They can't check the AI's actual answer, because it's different every time. That's what the user-test steps above are for.

<TODO before submitting: "I followed these steps on main on <date> and all 5 passed.">

---

## Feature: `/learn-quiz` command

**Owner:** Dika · **Issues:** #3, #26, #28, #30 · **PRs:** #13, #27, #29, #31

> As a student preparing for labs or homework interviews, I want opencode to automatically generate short questions based on the code I just wrote that make me justify my decisions and explore "what would happen if..." hypotheticals, so that I can verify my understanding.

`/learn-quiz` quizzes you on your own code. It was built in four steps, all for this one user story:

| Issue | PR | What it added |
|-------|----|---------------|
| #3 | #13 | The `/learn-quiz` command, using the Reflection Question prompt (#7) |
| #26 | #27 | An interactive quiz view in the terminal app: one question at a time, with back, skip and quit. The long prompt is hidden from the chat |
| #28 | #29 | Five question types, graded multiple choice, and arguments to choose the code, the number of questions, the difficulty and the format |
| #30 | #31 | Hints, feedback on every answer, and a summary with next steps at the end |

### How to use it

The quiz view is part of the **terminal app (TUI)**. From the repo root, run:

```bash
bun dev .
```

The `.` opens the repo root as the project. Without it, opencode opens `packages/opencode`, and file paths won't match. Pick a model that supports tool calling with `/models`. If it doesn't support tool calling, the questions are printed as a plain list instead of the quiz view. In the web app, `/learn-quiz` still works, but questions show in the web app's normal question box instead of the quiz view.

1. In the chat box, type `/learn-quiz` and press enter. You can add options:

   ```
   /learn-quiz [file | --diff] [--count <3-10>] [--level <level>] [--format <format>] [-h | --help]
   ```

   | Option | What it does | Default |
   |--------|--------------|---------|
   | `file` | Quiz on one file, e.g. `src/app.ts` | Your recent changes (uncommitted changes, or your last commits) |
   | `--diff` | Quiz only on your uncommitted changes | |
   | `--count <n>` | Number of questions, 3 to 10 | 5 |
   | `--level` | `beginner`, `intermediate` or `advanced`: how deep the questions go | `intermediate` |
   | `--format` | `mcq` multiple choice only, `frq` typed answers only, or `mixed` | `mixed` |
   | `-h`, `--help` | Show this list without starting a quiz | |

   If an option is wrong (for example `--count 50` or a file that doesn't exist), a red message explains what's wrong and shows the usage line. Nothing is sent to the AI.

2. The chat shows only what you typed. The AI reads your code and opens the quiz in place of the chat box. You see one question at a time, with "Question 2 of 5" at the top. Questions mix five types: why you made a choice, what would happen if something changed, trade-offs against another approach, what the code returns for an input, and multiple-choice concept checks.

3. Type your answer and press `enter` for the next question (`enter` on the last one submits). For multiple choice, pick with `↑` `↓` and `enter`, or `1`–`9`; `■` marks your pick. `shift+tab` / `tab` go back and forward and keep your answers, `ctrl+s` skips, `ctrl+o` shows or hides a hint (it points you where to look, but doesn't give the answer), and `esc` quits back to the chat.

4. After you submit, the AI replies with:
   - **Feedback** on every question. Multiple choice is marked Correct, Incorrect or Skipped, with the right answer. Typed answers get feedback on your reasoning, without the full answer and without rewriting your code.
   - **A summary**: Strong areas, Areas to review (including every question you skipped), and at least one concrete Next step, such as a concept to read about, a function to revisit, or running `/learn-recap` on a file.

### How to user-test it (about 15 minutes)

Run `bun dev .` from the repo root and pick a model that supports tool calling (see above). The steps use `packages/app/src/pages/home/focus-session/controller/presets.ts`, a short file in this repo.

| # | Do this | You should see |
|---|---------|----------------|
| 1 | Run `/learn-quiz --help` | A help box listing every option, its default, and the quiz keys. No quiz starts |
| 2 | Close it, then run `/learn-quiz --count 50` | A red message: `--count must be a whole number from 3 to 10`, ending with the usage line. Nothing is sent to the AI |
| 3 | Run `/learn-quiz packages/app/src/pages/home/focus-session/controller/presets.ts` | The chat shows only your command, not the long prompt. The quiz opens at "Question 1 of 5" |
| 4 | Go through the questions with `tab` | 5 questions, each about something specific in `presets.ts`. At least three types, including one "why" question and one "what would happen if..." question. One or two are multiple choice with `□` options that show full answer text |
| 5 | On any question, press `ctrl+o`, then `ctrl+o` again | A hint appears below the question, then hides. The hint doesn't give the answer |
| 6 | Type an answer, press `enter`, then `shift+tab` | You're back on the previous question with your answer still there |
| 7 | Answer the rest, skipping one with `ctrl+s`, and press `enter` on the last question | The quiz closes. The AI replies with Feedback for every question: multiple choice marked Correct or Incorrect, typed answers get feedback without the full answer, and the skipped one is marked Skipped |
| 8 | Read the end of the reply | A Summary with Strong areas, Areas to review (your skipped question is listed), and at least one Next step |
| 9 | Run the same file with `--format mcq --count 3 --level beginner` | Exactly 3 questions, all multiple choice, simpler than before |
| 10 | Run the same file with `--format frq --level advanced` | All typed questions, going deeper (for example, failure cases or how the design would change) |
| 11 | Start any quiz and press `esc` | The quiz closes and you're back at the chat box with no error |
| 12 | Change any file a little, then run `/learn-quiz --diff` | The questions are about the change you just made |
| 13 | Run `/learn-recap` or `/init` | They work as before, and their prompt still shows in the chat as it did before this feature |

### Automated tests

**Where they are** (6 files, 102 tests for this feature):

| File | Tests | What it checks |
|------|-------|----------------|
| `packages/opencode/test/command/learn-quiz.test.ts` | 37 | `/learn-quiz` is registered, uses the `learn-quiz.txt` prompt, and the other commands are unchanged |
| `packages/opencode/test/command/learn-quiz-args.test.ts` | 17 | Reading the options: every option, defaults, `--help`, and every kind of invalid input |
| `packages/opencode/test/command/reflection-questions-template.test.ts` | 22 | What the prompt tells the AI: question types, levels, formats, hints, feedback and summary. Shared with the Reflection Question template (#7) |
| `packages/opencode/test/session/prompt.test.ts` | 8 | Running the real command: the prompt is hidden from the chat, the AI gets the checked settings, and bad options are rejected before anything is sent. Only the tests named `learn-quiz …` and "other commands still show their template" |
| `packages/opencode/test/tool/question.test.ts` | 1 | A hint reaches the question the student sees but isn't sent back to the AI. Only "passes a quiz hint on at the end of the question text…" |
| `packages/tui/test/cli/tui/quiz.test.tsx` | 17 | The quiz view, drawn in a test terminal with real key presses: progress, answer, back, skip, quit, multiple choice, hints and help |

**How to run them:**

```bash
cd packages/opencode
bun test test/command/learn-quiz.test.ts test/command/learn-quiz-args.test.ts test/command/reflection-questions-template.test.ts test/tool/question.test.ts
bun test test/session/prompt.test.ts -t "learn-quiz|other commands still"

cd ../tui
bun test test/cli/tui/quiz.test.tsx
```

They also run in CI (GitHub Actions) on every PR.

**What they check:**

| Acceptance criterion | Test file / test name |
|----------------------|-----------------------|
| **#3: `/learn-quiz` command** | |
| `/learn-quiz` is recognized as a valid opencode command | `learn-quiz.test.ts` / "is recognized as a valid command", "learn-quiz appears in the command list" |
| The command uses relevant code/project context when generating questions | `reflection-questions-template.test.ts` / "reads the code for each scope", "falls back to the student's recent work when there is no input" |
| The response generates a short set of reflection questions | `reflection-questions-template.test.ts` / "asks for the number of questions in the settings, grounded in the code"; `learn-quiz-args.test.ts` / "defaults to recent changes, a short quiz, intermediate depth, and mixed questions" |
| Questions ask why an implementation/design decision was made | `reflection-questions-template.test.ts` / "mixes at least three types, always with design justification and alternative scenario"; `learn-quiz.test.ts` / "learn-quiz template asks for design-decision justification ('why')" |
| At least one "what would happen if..." or alternative-scenario question | Same as above; `learn-quiz.test.ts` / "learn-quiz template asks for at least one alternative-scenario question" |
| Questions do not simply reveal solutions or rewrite the code | `reflection-questions-template.test.ts` / "does not reveal answers or rewrite the code"; `learn-quiz.test.ts` / "learn-quiz template tells the model not to reveal solutions or rewrite code" |
| Relevant automated tests pass | CI runs on PRs #13, #27, #29, #31 |
| Existing opencode commands continue to work | `learn-quiz.test.ts` / "leaves the existing built-in commands unchanged", "init and review descriptions are unchanged" |
| **#26: Interactive quiz view** | |
| `/learn-quiz` opens a quiz view instead of printing questions as text | `reflection-questions-template.test.ts` / "asks the questions through the interactive quiz instead of printing them"; `quiz.test.tsx` / "quiz shows one question at a time with progress" |
| Questions are shown one at a time with visible progress | `quiz.test.tsx` / "quiz shows one question at a time with progress" |
| The student can answer, go back, skip, or quit | `quiz.test.tsx` / "quiz submits every answer after the last question", "quiz keeps answers when going back and forth", "skipping a question leaves it unanswered", "quitting leaves the quiz without submitting" |
| Answers are kept when going back and forth | `quiz.test.tsx` / "quiz keeps answers when going back and forth", "multiple choice and typed answers are kept when going back" |
| Quitting early returns to the normal session without errors | `quiz.test.tsx` / "quitting leaves the quiz without submitting"; `reflection-questions-template.test.ts` / "handles skipped questions and a dismissed quiz"; user-test step 11 |
| The prompt template is not shown to the student | `prompt.test.ts` / "learn-quiz shows the typed command and keeps its template visible only to the model" |
| Existing commands continue to work | `prompt.test.ts` / "other commands still show their template" |
| **#28: Question types and arguments** | |
| At least three question types, including design justification and alternative scenario | `reflection-questions-template.test.ts` / "offers all five question types", "mixes at least three types, always with design justification and alternative scenario" |
| Questions reference the student's actual code | `reflection-questions-template.test.ts` / "asks for the number of questions in the settings, grounded in the code" |
| Multiple-choice answers are graded and the result is shown | `reflection-questions-template.test.ts` / "grades multiple choice questions and shows the result"; `quiz.test.tsx` / "multiple choice questions show their options and take the highlighted one on enter" |
| A file path or `--diff` scopes the quiz; recent changes by default | `learn-quiz-args.test.ts` / "a bare argument scopes the quiz to that file", "--diff scopes the quiz to uncommitted changes", "defaults to recent changes, …"; `reflection-questions-template.test.ts` / "reads the code for each scope" |
| `--count` sets the number of questions | `learn-quiz-args.test.ts` / "--count sets the number of questions"; `reflection-questions-template.test.ts` / "treats the question count as the exact total, concept checks included" |
| `--level` changes the depth of the questions | `learn-quiz-args.test.ts` / "--level sets the depth, ignoring case"; `reflection-questions-template.test.ts` / "matches question depth to each level" |
| Invalid arguments give a clear error message | `learn-quiz-args.test.ts` / "rejects unknown options", "rejects a count that is not a whole number in range", "rejects an unknown level", "rejects an unknown format", "rejects flags with a missing value", "rejects a file together with --diff", "rejects more than one file"; `prompt.test.ts` / `learn-quiz rejects "…" with a clear error and sends nothing` (5 cases) |
| *(Extra)* `--format` and `--help` | `learn-quiz-args.test.ts` / "--format picks multiple choice only, …", "-h and --help anywhere answer with just the usage line"; `reflection-questions-template.test.ts` / "matches the answer format to each format setting"; `quiz.test.tsx` / "help opens for -h or --help on /learn-quiz, wherever the flag is", "help explains every option and the quiz keys" |
| *(Extra)* The AI gets the checked settings, not the raw options | `prompt.test.ts` / "learn-quiz hands the model validated settings instead of the raw flags" |
| **#30: Feedback, hints and summary** | |
| Each answer gets feedback on the reasoning, without the full solution or rewritten code | `reflection-questions-template.test.ts` / "gives feedback on every answer's reasoning without revealing the solution" |
| Hints are available per question and don't give away the answer | `reflection-questions-template.test.ts` / "adds a hidden hint to every question", "keeps hints from giving away the answer"; `question.test.ts` / "passes a quiz hint on at the end of the question text, …"; `quiz.test.tsx` / "hints stay hidden until ctrl+o, and ctrl+o hides them again", "each question keeps its own hint state, including multiple choice", "questions without a hint show no hint key, …" |
| The quiz ends with a summary of strengths and areas to review | `reflection-questions-template.test.ts` / "ends with a summary of strengths, areas to review, and next steps" |
| The summary includes at least one concrete next step | Same as above |
| Skipped questions appear in the summary | `reflection-questions-template.test.ts` / "reflects skipped questions in the summary" |
| Existing commands continue to work | `prompt.test.ts` / "other commands still show their template"; `learn-quiz.test.ts` / "init and review descriptions are unchanged" |

### Why these tests are enough

- **Every acceptance criterion of #3, #26, #28 and #30 has at least one test** (table above).
- **The tests run the real code, not copies:**
  - The option tests call the real option reader in `packages/opencode/src/command/learn-quiz.ts`.
  - The command tests load the real list of commands and the real `learn-quiz.txt` prompt.
  - `prompt.test.ts` runs the real `/learn-quiz` command against a fake AI server and checks exactly what the AI receives and what the chat shows.
  - `quiz.test.tsx` draws the real quiz view in a test terminal and presses real keys.
- **Edge cases and failures are covered:** every kind of bad option (with nothing sent to the AI), `--help` anywhere, going back from the first question, skipping and quitting, options labelled only "A", "B", "C", questions without a hint, and the question count including multiple choice.
- **What the tests can't check is covered by the user-test steps:**
  - The tests check what the prompt *tells* the AI to do, but not the AI's actual questions, hints, feedback or summary, which are different every time. Steps 4–10 and 12 cover those.
  - The switch from the chat box to the quiz view, and back after quitting, happens in the full app. Steps 3 and 11 cover that.

I followed these steps on main on 9 October 2026 and all 13 passed.

---

## Feature: `/learn-recap` command

**Owner:** Amen · **Issue:** #4 · **PR:** #10

> As a student using opencode to make code changes, I want a concise learning recap that explains what changed, why the change works, and the key software engineering concepts involved, so that I can understand the AI-generated solution instead of blindly accepting it.

This issue is the `/learn-recap` command. It uses the Learning Recap prompt template (#5).

### How to use it

1. <How to open the prompt and type the command.>
2. Run `/learn-recap`. <What change context it uses.>
3. <What the student sees.>

### How to user-test it (about <N> minutes)

<Setup, e.g. make a small code change first.>

| # | Do this | You should see |
|---|---------|----------------|
| 1 | Run `/learn-recap` | The command is recognized |
| 2 | <Run it after making a change> | A recap based on that change |
| 3 | <Read the recap> | It clearly explains what changed |
| 4 | <Read the recap> | It explains why the change works |
| 5 | <Read the recap> | It names relevant software engineering concepts |
| 6 | <Check your files after running it> | No source files were modified by the command |
| 7 | Run an existing command, e.g. `<command>` | It still works as before |

### Automated tests

**Where they live:** `<path/to/test-file.test.ts>` (<N> files, <N> tests).

**How to run them:**

```bash
<command that runs only your tests>
```

They also run in CI (GitHub Actions).

**What they cover:**

| Acceptance criterion (#4) | Test file / test name |
|---------------------------|-----------------------|
| `/learn-recap` is recognized as a valid opencode command | `<file>` / `<test name>` |
| Invoking the command generates a learning recap based on the relevant code/change context available to opencode | `<file>` / `<test name>` |
| The result contains a clear explanation of what changed | `<file>` / `<test name>` |
| The result explains why the change works | `<file>` / `<test name>` |
| The result identifies relevant software engineering concepts when applicable | `<file>` / `<test name>` |
| Running the command does not itself modify the student's source files | `<file>` / `<test name>` |
| The final command uses the Learning Recap prompt template from #5 rather than duplicated prompt text | `<file>` / `<test name>` |
| Relevant automated tests for command registration and behavior pass | CI run on PR #10 |
| Existing commands continue to work | `<file>` / `<test name>` |

### Why these tests are enough

- **Every acceptance criterion of #4 has at least one test** (table above).
- **The tests run the real code.** <Say which module the tests import and call.>
- **Edge cases and failures are covered:** <list them, e.g. no recent changes>.
- **What the tests don't cover is checked by hand.** <For example, the quality of the recap, covered by user-test steps 2-5.>

I followed these steps on main on <date> and all <N> passed.

---

## Feature: Learning Recap prompt template

**Owner:** Ayan Fatima · **Issue:** #5 · **PR:** #16

> As a student using opencode to make code changes, I want a concise learning recap that explains what changed, why the change works, and the key software engineering concepts involved, so that I can understand the AI-generated solution instead of blindly accepting it.

This issue is the reusable prompt template behind the `/learn-recap` command (#4).

### How to use it

1. <Where the template lives, e.g. `packages/.../learning-recap.txt`.>
2. <How a student triggers it, i.e. by running `/learn-recap`.>
3. <What the student sees.>

### How to user-test it (about <N> minutes)

<Setup, e.g. make a code change in a project.>

| # | Do this | You should see |
|---|---------|----------------|
| 1 | <Run `/learn-recap` after a change> | The explanation covers what changed |
| 2 | <Read the output> | It explains why the change works |
| 3 | <Read the output> | It names relevant software engineering concepts |
| 4 | <Read the output> | The language is clear and student-friendly |
| 5 | <Read the output> | It explains instead of generating extra code |
| 6 | <Try a project in a different language or framework> | The explanation still makes sense |

### Automated tests

**Where they live:** `<path/to/test-file.test.ts>` (<N> files, <N> tests).

**How to run them:**

```bash
<command that runs only your tests>
```

They also run in CI (GitHub Actions).

**What they cover:**

| Acceptance criterion (#5) | Test file / test name |
|---------------------------|-----------------------|
| The prompt asks the model to explain what changed in the relevant code | `<file>` / `<test name>` |
| The prompt explains why the change works | `<file>` / `<test name>` |
| The prompt identifies relevant software engineering concepts when applicable | `<file>` / `<test name>` |
| The explanation is written in clear, student-friendly language | `<file>` / `<test name>` |
| The prompt focuses on explanation and understanding rather than generating additional code | `<file>` / `<test name>` |
| A reusable Learning Recap prompt template is added to the appropriate opencode prompt/template structure | `<file>` / `<test name>` |
| The prompt does not assume a specific programming language or framework | `<file>` / `<test name>` |
| The template can be consumed by the `/learn-recap` command without duplicating the prompt content | `<file>` / `<test name>` |

### Why these tests are enough

- **Every acceptance criterion of #5 has at least one test** (table above).
- **The tests run the real code.** <Say which module the tests import and call.>
- **Edge cases and failures are covered:** <list them>.
- **What the tests don't cover is checked by hand.** <For example, the quality of the model's answer, covered by user-test steps 1-6.>

I followed these steps on main on <date> and all <N> passed.

---

## Feature: `/learn-tests` command

**Owner:** Mohamed Waiel Shikfa · **Issue:** #6 · **PR:** #15

> As a student writing tests in a new language or library, I want opencode to explain what each test does in plain language, so that I can understand the testing logic and become more confident writing tests independently in the future.

This issue is the `/learn-tests` command. It uses the Test Explanation prompt template (#2).

### How to use it

1. <How to open the prompt and type the command.>
2. Run `/learn-tests`. <How to select the tests to explain.>
3. <What the student sees.>

### How to user-test it (about <N> minutes)

<Setup, e.g. a project with a test file.>

| # | Do this | You should see |
|---|---------|----------------|
| 1 | Run `/learn-tests` | The command is recognized |
| 2 | <Run it on a test> | The output identifies the purpose of the test |
| 3 | <Read the output> | It describes the behavior being verified, not a line-by-line paraphrase |
| 4 | <Read the output> | It follows the Test Explanation template |
| 5 | Run an existing command, e.g. `<command>` | It still works as before |

### Automated tests

**Where they live:** `<path/to/test-file.test.ts>` (<N> files, <N> tests).

**How to run them:**

```bash
<command that runs only your tests>
```

They also run in CI (GitHub Actions).

**What they cover:**

| Acceptance criterion (#6) | Test file / test name |
|---------------------------|-----------------------|
| `/learn-tests` is recognized as a valid opencode command | `<file>` / `<test name>` |
| The output identifies the purpose of the relevant tests | `<file>` / `<test name>` |
| The explanation describes the behavior being verified rather than merely paraphrasing code line-by-line | `<file>` / `<test name>` |
| The final implementation uses the Test Explanation prompt template | `<file>` / `<test name>` |
| Relevant automated tests pass | CI run on PR #15 |
| Existing opencode functionality remains unaffected | `<file>` / `<test name>` |

### Why these tests are enough

- **Every acceptance criterion of #6 has at least one test** (table above).
- **The tests run the real code.** <Say which module the tests import and call.>
- **Edge cases and failures are covered:** <list them>.
- **What the tests don't cover is checked by hand.** <For example, the quality of the explanation, covered by user-test steps 2-4.>

I followed these steps on main on <date> and all <N> passed.

---

## Feature: Reflection Question prompt template

**Owner:** Ayan Fatima and Noor Al-Kuwari · **Issue:** #7 · **PR:** #9

> As a student preparing for labs or homework interviews, I want opencode to automatically generate short questions based on the code I just wrote that make me justify my decisions and explore "what would happen if..." hypotheticals, so that I can verify my understanding.

This is the prompt that the `/learn-quiz` command (#3) sends to the AI.

### How to use it

1. The prompt is saved in `packages/opencode/src/command/template/learn-quiz.txt`. It used to be called `reflection-questions.txt`; we renamed it in PR #23 so it matches the command name. The `/learn-quiz` command loads it from there (see `packages/opencode/src/command/index.ts`), so the prompt is only written once.
2. In a chat, type `/learn-quiz` and then the code you want to be quizzed on. This can be a file path, a function or feature name, or code you paste in. If you type nothing after it, it uses your latest work (your uncommitted changes, or your last commits).
3. The AI replies with 3 to 5 numbered questions about that code, then asks you to answer in your own words. It doesn't answer the questions for you, give hints, or rewrite your code.

### How to user-test it (about 5 minutes)

Open this repo as a project in opencode and start a new chat.

| # | Do this | You should see |
|---|---------|----------------|
| 1 | Run `/learn-quiz packages/app/src/pages/home/focus-session/controller/presets.ts` | 3–5 numbered questions, each about something specific in that file |
| 2 | Read the questions | At least one asks *why* something was done a certain way |
| 3 | Read the questions | At least one asks "what would happen if..." |
| 4 | Read the questions | None just asks you to remember syntax, and none is a yes/no question |
| 5 | Change any file a little, then run `/learn-quiz` with nothing after it | The questions are about the change you just made |

### Automated tests

**Where they are:** `packages/opencode/test/command/reflection-questions-template.test.ts` and `packages/opencode/test/command/learn-quiz.test.ts` (2 files, 13 tests).

**How to run them**, from `packages/opencode`:

```bash
bun test test/command/reflection-questions-template.test.ts test/command/learn-quiz.test.ts
```

They also run in CI (GitHub Actions) on every PR.

**What they check:**

| Acceptance criterion (#7) | Test file / test name |
|---------------------------|-----------------------|
| The prompt generates a short set of questions based on the supplied code or development context | `reflection-questions-template.test.ts` / "asks for a short set of questions grounded in the code", "takes the code to reflect on through $ARGUMENTS", "falls back to the student's recent work when there is no input" |
| Questions ask students to explain why implementation or design choices were made | `reflection-questions-template.test.ts` / "asks the student to explain why choices were made" |
| At least one question encourages "what would happen if..." reasoning when relevant | `reflection-questions-template.test.ts` / "includes a what-if question when relevant" |
| Questions promote understanding rather than simply asking students to recall syntax | `reflection-questions-template.test.ts` / "promotes understanding instead of recall" |
| *(Extra)* Doesn't give away answers or rewrite code; works for any language; easy-to-read format | `reflection-questions-template.test.ts` / "does not reveal answers or rewrite the code", "does not assume a language or framework", "uses a clear student-friendly output format" |
| *(Extra)* `/learn-quiz` uses this prompt, and the other commands still work | `learn-quiz.test.ts` / "uses the Reflection Question prompt template", "leaves the existing built-in commands unchanged" |

### Why these tests are enough

- Every acceptance criterion has at least one test (see the table).
- The tests use the real prompt file and the real command code, not copies. `learn-quiz.test.ts` loads the actual list of commands and checks that `/learn-quiz` uses this prompt.
- They also check a few edge cases:
  - What happens when you give no input (it falls back to your recent changes).
  - `$ARGUMENTS` is the only placeholder in the prompt.
  - The prompt tells the AI not to give away answers or rewrite code.
  - The prompt doesn't assume a programming language.
- The tests can only check what the prompt *tells* the AI to do. They can't check the actual questions, because they're different every time. That's what the user-test steps above are for.

<TODO before submitting: "I followed these steps on main on <date> and all 5 passed.">

---

## Feature: Focus Session

**Owner:** Noor Al-Kuwari · **Issue:** #17 · **PR:** #20

> As a student learning to code with opencode, I want to run timed focus sessions where opencode checks in on my progress, so that I stay focused and get help when I'm stuck.

Focus Session is a card on the opencode home page. You set a work time and a break time, and opencode opens a **study tab** where you work with the AI. While you work, it keeps you in that tab, asks "Need help?" if you go quiet or leave, and shows a colored bar of how focused you were. When the work time is up, your break starts on its own.

### How to use it

1. Find the **Focus Session** card at the top of the home page.
2. Choose a timing: **25 / 5**, **50 / 10**, or **Custom**. For Custom, work time can be 1–120 minutes and break time 0–60 minutes (whole numbers only). It remembers your choice for next time.
3. Click **Start session**. opencode goes full screen and opens a new **study tab** in your most recent project. (You need at least one project. If you don't have one, the card tells you to add one.)
4. While you're working:
    - **You stay in the study tab.** If you click another tab, go Home, or open a new tab, it takes you back and shows "Tabs are locked during focus time".
    - **The colored bar** fills up as time passes. Green means you were focused, yellow means distracted, and red means not focused.
    - If you don't do anything for **2 minutes**, or you **leave opencode**, it asks **"Need help?"** and the bar turns yellow. If you don't answer within **60 seconds**, it turns red.
        - **Yes, help me** asks the AI in your study tab for one small next step and the idea behind it, not the full answer.
        - **No, I'm fine** turns the bar green again.
    - You can **Pause / Resume** or **End session** at any time. A small floating timer shows on every page.
5. When the work time is over, **your break starts on its own** and the tabs unlock. If the break is 0 minutes, it's skipped.
6. After the break, click **Start another round** or **Done**. The card then shows your history: how many sessions, how many minutes you focused, and your average focus %.

> **Note:** a website can't stop you from opening other apps or browser tabs. So instead of blocking them, Focus Session *notices* when you leave: it asks "Need help?" right away, the bar turns yellow and then red, and the time you were away is saved in your history.

### How to user-test it (about 5 minutes)

Start the app as described at the top. Use **Custom** with work `3` and break `1` so one full round takes about 5 minutes.

| # | Do this | You should see |
|---|---------|----------------|
| 1 | Open the home page | The Focus Session card at the top |
| 2 | Choose Custom, type `0` for work, click Start | "Work time must be a whole number from 1 to 120 minutes" |
| 3 | Type `3` for work and `1` for break, click Start | Full screen, a new study tab, the timer at 3:00, and a green bar |
| 4 | Click Home, another tab, or `+` | It takes you back to the study tab and says "Tabs are locked during focus time" |
| 5 | Switch to another app for a few seconds, then come back | "Need help?" shows up and the bar turns yellow |
| 6 | Wait 60 seconds without answering | The bar turns red |
| 7 | Click **No, I'm fine** | The bar goes green again, and the yellow and red parts stay on it |
| 8 | Wait for "Need help?" again, then click **Yes, help me** | A help message shows up in the study tab and the AI answers |
| 9 | Click **Pause**, wait a bit, then **Resume** | The timer stops, then continues from where it stopped |
| 10 | Let the timer reach 0:00 | The break starts, tabs unlock, and the bar stops |
| 11 | After the break, click **Done** | The card shows "1 session · 3 focus minutes · N% focused on average" |

If step 8 shows "free tier can only be used from within OpenCode", the free default model doesn't work on local builds. Connect your own model provider and try again.

### Automated tests

**Where they are:** next to the code, in `packages/app/src/pages/home/focus-session/controller/*.test.ts` (9 files, 81 tests).

**How to run them**, from `packages/app`:

```bash
# run the tests
bun test --conditions=solid --preload ./happydom.ts ./src/pages/home/focus-session

# run the tests and show coverage
bun test --conditions=solid --preload ./happydom.ts ./src/pages/home/focus-session --coverage
```

They also run in CI (GitHub Actions) on every PR. The tests use a **fake clock**, so a 25-minute round finishes in milliseconds instead of really waiting 25 minutes. They also use a **fake music player** that only records what it was asked to do, so no sound plays.

**What they check:**

| Acceptance criterion (#17) | Test file |
|----------------------------|-----------|
| 25/5 and 50/10 presets; custom times are whole numbers, work 1–120, break 0–60 | `presets.test.ts` |
| Countdown, break starts on its own, 0-minute break is skipped, "another round" or "Done" | `session-controller.test.ts` |
| Pause, resume, and End session stop all the timers | `session-controller.test.ts` |
| Green → yellow after 2 min → red after 60 s; leaving asks right away; answering turns it green; grey when paused or on break | `idle-monitor.test.ts` |
| The bar shows green, yellow and red parts in the right order and restarts each round; focus % and time away | `focus-timeline.test.ts`, `focus-score.test.ts` |
| The student stays in the study tab (switching tabs, going Home, new tabs, a new chat replacing the draft) | `tab-guard.test.ts` |
| "Yes" sends a help message to the study tab; no project or server errors show a message instead of crashing | `help-prompt.test.ts` |
| Each session is saved to history (rounds, help requests, focus %, time away) | `history.test.ts` |
| Time left is shown as mm:ss and never goes below zero | `format.test.ts` |

### Why these tests are enough

- Every acceptance criterion has at least one test (see the table).
- The tests run the real code. All the logic (the timer, the status colors, the tab lock, the help message, the history) is in the `controller/` folder, separate from the screen code, so the tests can call it directly.
- They test the exact limits and the error cases:
  - exactly 2:00 before "Need help?" and exactly 60 seconds before red
  - work times of 1 and 120 minutes, and 0-minute breaks
  - starting twice
  - having no project
  - server errors when sending the help message
- The tests cover 93–100% of the lines in every `controller/` file.
- A few things can only be checked in a real browser: full screen, leaving the window, and the AI's real answer. The card and panels only show what the controller says. The user-test steps above cover all of these.

**TODO (replace before submitting):** I followed these steps on main on `<date>` and all 11 passed.

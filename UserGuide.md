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

**Owner:** Dika · **Issue:** #3 · **PR:** #13

> As a student preparing for labs or homework interviews, I want opencode to automatically generate short questions based on the code I just wrote that make me justify my decisions and explore "what would happen if..." hypotheticals, so that I can verify my understanding.

This issue is the `/learn-quiz` command. It uses the Reflection Question prompt template (#7).

### How to use it

1. <How to open the prompt and type the command.>
2. Run `/learn-quiz`. <What context it reads, e.g. the current project or recent changes.>
3. <What the student sees and how to answer.>

### How to user-test it (about <N> minutes)

<Setup, e.g. a project with some recent code.>

| # | Do this | You should see |
|---|---------|----------------|
| 1 | Run `/learn-quiz` | The command is recognized |
| 2 | <Run it in a project with code> | A short set of reflection questions about that code |
| 3 | <Read the questions> | At least one asks why a design choice was made |
| 4 | <Read the questions> | At least one asks "what would happen if..." or about an alternative |
| 5 | <Read the questions> | No solutions are revealed and no code is rewritten |
| 6 | Run an existing command, e.g. `<command>` | It still works as before |

### Automated tests

**Where they live:** `<path/to/test-file.test.ts>` (<N> files, <N> tests).

**How to run them:**

```bash
<command that runs only your tests>
```

They also run in CI (GitHub Actions).

**What they cover:**

| Acceptance criterion (#3) | Test file / test name |
|---------------------------|-----------------------|
| `/learn-quiz` is recognized as a valid opencode command | `<file>` / `<test name>` |
| The command uses relevant code/project context when generating questions | `<file>` / `<test name>` |
| The response generates a short set of reflection questions | `<file>` / `<test name>` |
| Questions include reasoning about why an implementation/design decision was made | `<file>` / `<test name>` |
| Questions include at least one meaningful "what would happen if..." or alternative-scenario question when appropriate | `<file>` / `<test name>` |
| Questions do not simply reveal solutions or rewrite the code | `<file>` / `<test name>` |
| Relevant automated tests pass | CI run on PR #13 |
| Existing opencode commands continue to work | `<file>` / `<test name>` |

### Why these tests are enough

- **Every acceptance criterion of #3 has at least one test** (table above).
- **The tests run the real code.** <Say which module the tests import and call.>
- **Edge cases and failures are covered:** <list them>.
- **What the tests don't cover is checked by hand.** <For example, the quality of the generated questions, covered by user-test steps 2-5.>

I followed these steps on main on <date> and all <N> passed.

---

## Feature: `/learn-recap` command

**Owner:** Amen · **Issue:** #4 · **PR:** #10 (tests added in PR #32)

> As a student using opencode to make code changes, I want a concise learning recap that explains what changed, why the change works, and the key software engineering concepts involved, so that I can understand the AI-generated solution instead of blindly accepting it.

This issue is the `/learn-recap` command. It uses the Learning Recap prompt template (#5).

### How to use it

1. In the chat prompt of the web app (see "Running the app" above), type `/learn-recap`.
2. Type `/learn-recap` on its own, or add what you want recapped after it, such as a file path, a commit, or a short description. With nothing after it, the command looks at your uncommitted changes (`git diff` and `git status`).
3. The AI replies with a short explanation of what changed, why the change works, and the software engineering concepts that are really involved, and it ends with one key takeaway. It does not modify your files. If there is nothing to explain, it says so instead of inventing a recap.

### How to user-test it (about 5 minutes)

Open this repo as a project in opencode and start a new chat. Make a small change first, for example add a comment or a tiny `if` check in any source file, and leave it uncommitted.

| # | Do this | You should see |
|---|---------|----------------|
| 1 | Type `/learn-recap` | The command is recognized and listed |
| 2 | Run `/learn-recap` right after making the change | A recap about the change you just made |
| 3 | Read the recap | It clearly explains what changed |
| 4 | Read the recap | It explains why the change works |
| 5 | Read the recap | It names relevant software engineering concepts, and only ones that really apply |
| 6 | Run `git status` after the command | The only changes are the ones you made yourself, so the command did not modify any files |
| 7 | Discard your change, then run `/learn-recap` with nothing after it | It says there is nothing to recap instead of making something up |
| 8 | Run an existing command, for example `/review` | It still works as before |

### Automated tests

**Where they live:** `packages/opencode/test/command/learn-recap.test.ts` (1 file, 31 tests). The tests were first in `index.test.ts` and were moved into this file in PR #32.

**How to run them**, from `packages/opencode`:

```bash
bun test test/command/learn-recap.test.ts
```

They also run in CI (GitHub Actions) on every PR.

**What they cover:**

| Acceptance criterion (#4) | Test file / test name |
|---------------------------|-----------------------|
| `/learn-recap` is recognized as a valid opencode command | `learn-recap.test.ts` / "learn-recap appears in the command list", "learn-recap can be retrieved individually", "learn-recap has the expected name, description, and source" |
| Invoking the command generates a learning recap based on the relevant code/change context available to opencode | `learn-recap.test.ts` / "accepts the student's scope via $ARGUMENTS", "falls back to uncommitted changes when there is no input", "reads surrounding code instead of relying on the diff alone", "$ARGUMENTS is replaced with the given scope when invoked with arguments" |
| The result contains a clear explanation of what changed | `learn-recap.test.ts` / "asks for what changed" |
| The result explains why the change works | `learn-recap.test.ts` / "asks for why the change works" |
| The result identifies relevant software engineering concepts when applicable | `learn-recap.test.ts` / "asks for the relevant software engineering concepts", "only mentions software engineering concepts genuinely relevant to the code" |
| Running the command does not itself modify the student's source files | `learn-recap.test.ts` / "explicitly tells the model not to modify the student's files", "does not instruct the model to edit, write, delete, or remove files", "runs inline (not as a subtask) with no agent or model override" |
| The final command uses the Learning Recap prompt template from #5 rather than duplicated prompt text | `learn-recap.test.ts` / "learn-recap template is exactly the contents of learn-recap.txt" |
| Relevant automated tests for command registration and behavior pass | CI run on PR #10 |
| Existing commands continue to work | `learn-recap.test.ts` / "init and review are still retrievable after adding learn-recap", "init, review, learn-quiz, learn-test, and learn-recap are all registered with no duplicate names" |

### Why these tests are enough

- **Every acceptance criterion of #4 has at least one test** (table above).
- **The tests run the real code.** They import the real `learn-recap.txt` and use the same `Command.Service` the app uses at runtime, not copies, so they fail if the template or the registration breaks.
- **Edge cases and failures are covered:**
  - no input falls back to uncommitted changes
  - nothing to explain, so the AI says so instead of inventing a recap
  - the template has no leftover `${path}` placeholder
  - the template getter never throws
  - the command is not a subtask and has no agent or model override
- **What the tests don't cover is checked by hand.** The tests only check what the template *tells* the AI to do, not the AI's actual answer, because that is different every time. The quality of the recap is covered by user-test steps 2 to 5, and "no files changed" by step 6.

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

---

## Feature: `/learn-flow` command

**Owner:** Amen · **Issues:** #36 (extractor), #37 (renderer), #38 (tool), #39 (command) · **PRs:** #41 (renderer), #42 (extractor), #43 (tool), #44 (command)

> As a visual learner, I want opencode to generate an ASCII art flowchart or diagram of the current function's execution path, so that I can better understand complex logical branching.

`/learn-flow` draws a function as a flowchart in the chat, then explains it in plain language. Our own code reads the function and draws the chart, so the diagram is not a guess by the AI. The AI only explains it. This is a **static** diagram of the paths the code could take. It does not run the code, so it is not a step-by-step debugger.

It has four parts:

- **Extractor (#36):** parses a function with tree-sitter and builds a graph of its steps and decisions.
- **Renderer (#37):** turns that graph into ASCII boxes and arrows.
- **Tool (#38):** a read-only `learn_flow` tool the AI calls with a file path and a function name.
- **Command (#39):** the `/learn-flow` command and its prompt template, `learn-flow.txt`.

### How to use it

1. In the chat prompt of the web app, type `/learn-flow` followed by a file path and a function name, for example:

```
   /learn-flow packages/opencode/src/command/learn-flow/render.ts renderFlowchart
```

2. The AI calls the `learn_flow` tool and shows the diagram in a code block, exactly as the tool returned it.
3. It then explains what each decision checks, where each path leads, where loops repeat, and names the concepts involved, such as early return, loop, switch or recursion. It ends with one question to check your understanding. It does not rewrite your code or change any files.
4. If you type no file or no function, it asks which one you mean.

**What it supports:** TypeScript and JavaScript functions, class methods, and arrow functions assigned to a `const`. It draws `if`/`else`, `else if` chains, `switch` (including fallthrough), `for`, `while`, `do...while`, `for...of`, `for...in`, `break`, `continue` and early returns. A recursive call is shown as its own step.

**What it does not support:** `try/catch`, labeled statements, `with`, and async or generator functions are drawn as one box marked `unsupported`, and the AI says the diagram is incomplete there. Very long functions make diagrams that are tall and wide.

### How to user-test it (about 5 minutes)

Open this repo as a project in opencode, start a new chat, and connect a model provider. Create a file `demo.ts` in the project folder (do not commit it):

```ts
export function grade(score: number) {
  if (score >= 90) return "A"
  if (score >= 80) return "B"
  return "C"
}

export function total(n: number) {
  let sum = 0
  for (let i = 0; i < n; i++) sum += i
  return sum
}

export function safe(x: string) {
  try {
    return JSON.parse(x)
  } catch {
    return null
  }
}
```

| # | Do this | You should see |
|---|---------|----------------|
| 1 | Type `/learn-flow` | The command is recognized and listed |
| 2 | Run `/learn-flow demo.ts grade` | A flowchart in a code block with `score >= 90`, `score >= 80` and the three returns, each branch under its decision |
| 3 | Read the explanation | It says what each decision checks and where each path ends, and names early return |
| 4 | Run `/learn-flow demo.ts total` | The diagram has a "loops back to" line, and the explanation says what repeats and when it stops |
| 5 | Run `/learn-flow demo.ts safe` | A box marked `unsupported: try/catch`, and the AI says that part could not be drawn |
| 6 | Run `/learn-flow demo.ts missing` | A readable message that the function was not found, and no invented diagram |
| 7 | Run `/learn-flow` with nothing after it | It asks which file and function you mean |
| 8 | Run `git status` | Only `demo.ts` is new, so no existing file was changed |
| 9 | Run an existing command, for example `/review` | It still works as before |

### Automated tests

**Where they live:** 4 test files, 78 tests in total.

| Part | File | Tests |
|------|------|-------|
| Renderer (#37) | `packages/opencode/test/flow/render.test.ts` | 12 |
| Extractor (#36) | `packages/opencode/test/flow/extract.test.ts` | 42 |
| Tool (#38) | `packages/opencode/test/tool/learn-flow.test.ts` | 10 |
| Command (#39) | `packages/opencode/test/command/learn-flow.test.ts` | 14 |

The tool is also checked by one test in `test/tool/registry.test.ts` (the tool is registered) and a snapshot in `test/tool/parameters.test.ts`.

**How to run them**, from `packages/opencode`:

```bash
bun test test/flow test/tool/learn-flow.test.ts test/tool/registry.test.ts test/command/learn-flow.test.ts
bun run typecheck
```

They also run in CI (GitHub Actions) on every PR.

**What they cover:**

| Acceptance criterion | Test file / test name |
|----------------------|-----------------------|
| **#37:** a linear flow, if/else, nested if, early return and unsupported boxes render correctly | `render.test.ts` / the linear, decision, nested if and unsupported tests |
| **#37:** multi-way branches, loops with a back edge, and long labels render without losing text | `render.test.ts` / the multi-way, loop and long label tests |
| **#37:** the same input always gives the same output; empty or invalid graphs return an error message instead of throwing | `render.test.ts` / the determinism, empty graph and unknown node tests |
| **#36:** sequences, if/else, else-if chains, switch, loops, break/continue and early returns produce the correct graph | `extract.test.ts` / the sequence, if, else-if, switch and loop tests |
| **#36:** recursion becomes its own step; try/catch, labeled statements and async functions become one `unsupported` node | `extract.test.ts` / the recursion, try/catch and async tests |
| **#36:** an unknown function, a syntax error or empty source returns a clear error and never throws | `extract.test.ts` / the unknown name, syntax error, empty source and odd input tests |
| **#36 to #37:** source text goes through the extractor and the renderer end to end | `extract.test.ts` / the `discount` end-to-end test |
| **#38:** the tool is registered and discoverable | `registry.test.ts` / "exposes learn_flow", and `parameters.test.ts` snapshot |
| **#38:** valid input returns a diagram; relative paths resolve against the project directory | `learn-flow.test.ts` (tool) / the valid input and relative path tests |
| **#38:** a missing file, a directory, an unknown function and a syntax error return a readable message | `learn-flow.test.ts` (tool) / the matching error tests |
| **#38:** the tool asks for the `read` permission and checks `external_directory`, and never writes | `learn-flow.test.ts` (tool) / the permissions and read-only tests |
| **#39:** `/learn-flow` is recognized, with the right name, description and source, and runs inline | `learn-flow.test.ts` (command) / the registration and fields tests |
| **#39:** the command uses the template file, not duplicated prompt text | `learn-flow.test.ts` (command) / "template is exactly the contents of learn-flow.txt" |
| **#39:** the template calls the `learn_flow` tool, shows the diagram unchanged, explains it, never rewrites code and handles tool failures | `learn-flow.test.ts` (command) / the template content tests |
| **#39:** the tool name in the template matches the registered tool id | `learn-flow.test.ts` (command) / the registry id test |
| Relevant automated tests pass | CI runs on the PRs for #36, #37, #38 and #39 |
| Existing commands continue to work | `learn-flow.test.ts` (command) / "init, review, learn-recap, learn-quiz, learn-test and learn-flow are all registered with no duplicate names" |

### Why these tests are enough

- **Every acceptance criterion of #36 to #39 has at least one test** (table above).
- **The tests run the real code.** The extractor tests parse real source with tree-sitter, the renderer tests call the real `renderFlowchart`, the tool tests run the real tool with a temporary project folder, and the command tests use the real `Command.Service` and the real `learn-flow.txt`. One test sends source text through the extractor and the renderer together.
- **Edge cases and failures are covered:** empty and invalid graphs, unknown nodes, unknown functions, syntax errors, empty source, odd input such as null characters and unterminated strings, missing files, directories, paths outside the project, and unsupported syntax. None of these throws.
- **The parts are small and separate.** The extractor and the renderer are plain functions with no AI calls, so their tests are exact and repeatable.
- **What the tests don't cover is checked by hand.** The tests check what the template *tells* the AI to do, not what a live model answers, and they cannot check how readable a diagram is. User-test steps 2 to 7 cover those.

### Known limitations

- Only TypeScript and JavaScript are supported. The extractor uses `tree-sitter-typescript` 0.23.2, while the other grammars in the repo are 0.25.x. It loads without errors and is covered by the tests.
- The diagram is static. It shows the order of decisions, not the values of variables.
- Constructs listed under "What it does not support" show as one `unsupported` box.

<TODO before submitting: "I followed these steps on main and all 9 passed.">
# Focus Session

A learning companion for the opencode web/desktop app. Students run timed work periods in a
**study tab** where they work with the AI, take automatic breaks, and get a check-in from
opencode when they go quiet or leave. A colored timeline shows how focused each round was.

> User story: As a student learning to code with opencode, I want to run timed focus sessions
> where opencode checks in on my progress, so that I stay focused and get help when I'm stuck.

Issue: #17 (session controller, lock, status). Companions (#18) and music/confetti (#19) build on it.

## How to use it

1. Open opencode (web or desktop). The **Focus Session** card is at the top of the home dashboard.
2. Pick a timing: **25 / 5**, **50 / 10**, or **Custom** (work 1–120 min, break 0–60 min, whole
   numbers). Your choice is remembered next time.
3. You need at least one project (**Add project** on the left). Click **Start session**.
4. opencode goes full screen and opens a new **study tab** in your most recent project.
   Ask the AI anything there; this is where you work.
5. While the work timer runs:
   - **You stay in the study tab.** Switching to another opencode tab, going Home, or opening a new
     tab sends you back to it ("Tabs are locked during focus time"). Tabs unlock on the break.
   - **The timeline bar** fills left to right over the round. Each stretch is colored by how you
     were doing at that moment: **green** = focused, **yellow** = distracted, **red** = not focused.
     Grey is time not reached yet.
   - After **2 minutes without activity**, or as soon as you **leave opencode** (another browser
     tab or app), opencode asks **"Need help?"** (yellow). If you don't answer within **60 seconds**
     it turns red.
     - **Yes, help me** sends a help prompt to the agent in your study tab. The prompt asks for one
       small next step and the idea behind it, not the full solution.
     - **No, I'm fine** goes back to green.
   - **Pause / Resume** and **End session** are always available. A small floating panel keeps the
     timer visible on every page.
6. When work ends, the **break starts automatically**: tabs unlock, the bar stops, the timer counts
   the break down. A 0-minute break is skipped.
7. After the break choose **Start another round** (back to the same study tab) or **Done**.
8. The card shows your history: sessions, focus minutes and average focus %.

### What it can and cannot lock

A web page cannot stop you from opening other apps or browser tabs; browsers do not allow it.
Focus Session locks what it can (opencode's own tabs), uses full screen as a speed bump, and
**detects and records** leaving instead: you get the check-in immediately, the timeline turns
yellow/red, and the time away is saved in your session history.

## How it works (for developers)

Everything lives in `packages/app/src/pages/home/focus-session/`. The only change outside it is
two lines in `packages/app/src/pages/home.tsx` that mount the card.

| File | Role |
| --- | --- |
| `controller/session-controller.ts` | One controller for the timer **and** music: work → break → "another round?", pause/resume/end, fade, ducking. Clock and audio are injected. |
| `controller/presets.ts` | Presets and custom-time validation. |
| `controller/idle-monitor.ts` | Status: green (active) → yellow after 2 min or on leaving → red after 60 s unanswered; grey when not working. |
| `controller/focus-timeline.ts` | Records the colored stretches of a round and lays them out as percentages. |
| `controller/focus-score.ts` | Focus % for the session and time away; feeds history. |
| `controller/tab-guard.ts` | Decides which tabs to close and where to navigate to keep the student in the study tab. |
| `controller/help-prompt.ts` | Builds the help prompt and sends it through the opencode SDK. |
| `controller/history.ts` | One record per session (rounds, help requests, focus %, minutes away), newest 50 kept. |
| `session-store.ts` | Connects the controller to the app: tabs, SDK, activity/visibility events, full screen, saved preferences (existing `persisted()` storage, key `focus-session.v1`). |
| `focus-session-card.tsx`, `components/*` | The card, the shared active panel, the floating panel and the timeline bar. |
| `copy.ts`, `focus-session.css` | All visible text and the feature's own styles (existing theme tokens only). |

The logic in `controller/` is plain TypeScript with no UI code, which is what makes it testable
without a browser, a server or real time passing.

## How to test it

### Automated tests (Bun)

From `packages/app`:

```bash
bun test --conditions=solid --preload ./happydom.ts ./src/pages/home/focus-session
bun test --conditions=solid --preload ./happydom.ts ./src/pages/home/focus-session --coverage
```

The tests are next to the code, in `controller/*.test.ts` (81 tests). They also run in CI as part
of the app package's `test:unit`. They use a **fake clock** (time only moves when the test says so)
and a **fake audio player** (records calls, never plays sound), so a 25-minute round takes
milliseconds.

| Acceptance criterion (#17) | Tests |
| --- | --- |
| Presets 25/5 and 50/10; custom times validated (whole numbers, work 1–120, break 0–60) | `presets.test.ts` |
| Countdown, work → automatic break, 0-minute break skipped, "another round" / "Done" | `session-controller.test.ts` |
| Pause, resume, End session clears every timer | `session-controller.test.ts` |
| Music starts with the timer, loops, pauses/resumes with it, fades in the last 5 s, stops before the celebration, stops on end/cancel, ducks, silent on break, "No music" works | `session-controller.test.ts` |
| Green → yellow after 2 min → red after 60 s; leaving opencode checks in immediately; answers return to green; grey when paused or on break | `idle-monitor.test.ts` |
| Colored timeline: green/yellow/red stretches in order, fresh bar each round | `focus-timeline.test.ts`, `focus-score.test.ts` |
| Student kept in the study tab (switching, going Home, new tabs, draft becoming a session) | `tab-guard.test.ts` |
| "Yes" sends a help prompt into the study session; errors reported without crashing | `help-prompt.test.ts` |
| Session history saved (rounds, help requests, focus %, time away) | `history.test.ts` |

**Why this is sufficient:** every acceptance criterion of #17 maps to tests that drive the real
controller logic (not copies of it), including the boundaries (exactly 2:00 to yellow, exactly
5 s of fade, 0-minute break, 1 and 120 minute limits) and failure paths (no project, server
errors). All of the feature's decisions live in `controller/`, which has 93–100% line coverage;
the UI components only display that state and call it, and are covered by the manual checks below.

### Manual check (about 5 minutes)

Run the server (`bun dev serve`) and the web app (`bun run --cwd packages/app dev`), open the URL
it prints, and make sure you have a project.

1. **Card on first open:** the Focus Session card is at the top of the home dashboard.
2. **Validation:** Custom with work `0` shows an error; work `3`, break `1` starts.
3. **Start:** opencode goes full screen and a study tab opens. Send the AI a message.
4. **Tab lock:** click the Home icon or another tab, or press `+` → you are sent back, with the
   "Tabs are locked" notice.
5. **Timeline:** the bar grows green. Switch to another app for 30 s and come back → "Need help?"
   and the bar continues yellow. Wait 60 s → it continues red. Click **No** → green again; the
   earlier yellow and red stay visible.
6. **Help:** trigger the check-in again and click **Yes** → the help prompt appears in the study tab.
7. **Timer and music stay in sync:** pause → the countdown freezes (and, once #19 adds music, the
   music pauses at the same moment); resume → both continue. At 0:00 the break starts, tabs unlock,
   the bar stops.
8. After the break → **Done** → the card shows "1 session · 3 focus minutes · N% focused on average".

Tip: after editing the code, reload the page; hot reload can leave a duplicate floating panel in dev.

## Known limitations

- Other apps and browser tabs cannot be blocked (see above); leaving is detected and recorded.
- UI text is in `copy.ts` (English) rather than the shared i18n files, to avoid editing shared files
  during the sprint; it can be moved to i18n in one step.
- Music (#19) and companion pets (#18) are separate issues; until #19 lands, sessions run silently.
- On a local dev build the free "Big Pickle" model may reject prompts ("free tier can only be used
  from within OpenCode"); connect your own provider to test the help prompt end to end.

import { describe, expect, test } from "bun:test"
import { type GuardTab, planTabGuard } from "./tab-guard"

const draft: GuardTab = { key: "draft:d1", href: "/new-session?draftId=d1", draftID: "d1" }
const other: GuardTab = { key: "s\n/server/abc/session/old", href: "/server/abc/session/old", sessionID: "old" }
const promoted: GuardTab = { key: "s\n/server/abc/session/new", href: "/server/abc/session/new", sessionID: "new" }
const at = (href: string) => {
  const [pathname, search = ""] = href.split("?")
  return { pathname, search: search ? `?${search}` : "" }
}

describe("planTabGuard", () => {
  test("does nothing while the student stays in the study tab", () => {
    const plan = planTabGuard({
      lock: { focusKey: draft.key, baseline: [other.key] },
      tabs: [other, draft],
      location: at(draft.href),
    })
    expect(plan).toEqual({ focus: draft, remove: [], navigate: undefined, blocked: false })
  })

  test("switching to another existing tab sends the student back", () => {
    const plan = planTabGuard({
      lock: { focusKey: draft.key, baseline: [other.key] },
      tabs: [other, draft],
      location: at(other.href),
    })
    expect(plan).toMatchObject({ navigate: draft.href, remove: [], blocked: true })
  })

  test("going home sends the student back", () => {
    const plan = planTabGuard({ lock: { focusKey: draft.key, baseline: [] }, tabs: [draft], location: at("/") })
    expect(plan).toMatchObject({ navigate: draft.href, blocked: true })
  })

  test("new tabs opened during work are closed", () => {
    const extra: GuardTab = { key: "draft:d2", href: "/new-session?draftId=d2", draftID: "d2" }
    const plan = planTabGuard({
      lock: { focusKey: draft.key, baseline: [other.key] },
      tabs: [other, draft, extra],
      location: at(extra.href),
    })
    expect(plan).toEqual({ focus: draft, remove: ["draft:d2"], navigate: draft.href, blocked: true })
  })

  test("follows the study tab when its draft becomes a session", () => {
    const plan = planTabGuard({
      lock: { focusKey: draft.key, baseline: [other.key] },
      tabs: [other, promoted],
      location: at(promoted.href),
    })
    expect(plan).toEqual({ focus: promoted, remove: [], navigate: undefined, blocked: false })
  })

  test("query order does not matter when comparing locations", () => {
    const plan = planTabGuard({
      lock: { focusKey: draft.key, baseline: [] },
      tabs: [draft],
      location: { pathname: "/new-session", search: "?draftId=d1" },
    })
    expect(plan.blocked).toBe(false)
  })

  test("reports a missing study tab so the store can reopen it", () => {
    const plan = planTabGuard({
      lock: { focusKey: promoted.key, baseline: [other.key] },
      tabs: [other],
      location: at(other.href),
    })
    expect(plan).toEqual({ focus: undefined, remove: [], navigate: undefined, blocked: false })
  })
})

// Tab lock for work periods: the student stays in one study tab (where they work with the AI).
// Pure decision logic; the session store applies the result through the app's tabs context.

export type GuardTab = {
  key: string
  href: string
  draftID?: string
  sessionID?: string
}

export type TabLock = {
  focusKey: string
  // Tabs that already existed when the lock started. Anything newer (except the study tab) is closed.
  baseline: readonly string[]
}

export type TabGuardPlan = {
  focus?: GuardTab
  remove: string[]
  navigate?: string
  blocked: boolean
}

export function planTabGuard(input: {
  lock: TabLock
  tabs: readonly GuardTab[]
  location: { pathname: string; search: string }
}): TabGuardPlan {
  const focus = findFocus(input.lock, input.tabs)
  const remove = input.tabs
    .filter((tab) => tab.key !== focus?.key && !input.lock.baseline.includes(tab.key))
    .map((tab) => tab.key)
  const navigate = focus && !isAt(focus.href, input.location) ? focus.href : undefined
  return { focus, remove, navigate, blocked: remove.length > 0 || !!navigate }
}

// The study tab starts as a draft; sending the first prompt replaces it with a session tab.
// That new session tab (not in the baseline) is still the study tab.
function findFocus(lock: TabLock, tabs: readonly GuardTab[]) {
  const current = tabs.find((tab) => tab.key === lock.focusKey)
  if (current) return current
  if (!lock.focusKey.startsWith("draft:")) return undefined
  return tabs.find((tab) => !!tab.sessionID && !lock.baseline.includes(tab.key))
}

function isAt(href: string, location: { pathname: string; search: string }) {
  const [path, query] = href.split("?")
  if (path !== location.pathname) return false
  if (!query) return true
  return new URLSearchParams(query).toString() === new URLSearchParams(location.search).toString()
}

import http from "k6/http"
import { check } from "k6"

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:4096"

// Read-only endpoints only. Excludes state-changing routes
// (/global/dispose, /global/upgrade), the event stream (/global/event),
// and session routes that call the LLM.
const endpoints = [
  { name: "health", path: "/global/health" },
  { name: "config", path: "/config" },
  { name: "project", path: "/project" },
]

// Nightly/manual runs also include the slower /provider endpoint
if (__ENV.INCLUDE_PROVIDER === "true") {
  endpoints.push({ name: "provider", path: "/provider" })
}

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    // Loose per-endpoint limits because shared CI runners are noisy
    "http_req_duration{endpoint:health}": ["p(95)<1000"],
    "http_req_duration{endpoint:config}": ["p(95)<1000"],
    "http_req_duration{endpoint:project}": ["p(95)<1000"],
    "http_req_duration{endpoint:provider}": ["p(95)<3000"],
  },
}

export default function () {
  for (const e of endpoints) {
    const res = http.get(`${BASE_URL}${e.path}`, { tags: { endpoint: e.name } })
    check(res, { [`${e.name} returns 200`]: (r) => r.status === 200 })
  }
}

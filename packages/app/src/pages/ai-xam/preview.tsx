import { render } from "solid-js/web"

const root = document.getElementById("root")

if (!root) {
  throw new Error("AI-xam preview root was not found")
}

root.style.cssText =
  "min-height:100vh;padding:24px;background:#101827;color:white;font-family:system-ui"

root.textContent = "Loading AI-xam..."

void Promise.all([
  import("../../index.css"),
  import("./ai-xam-page"),
])
  .then(([, module]) => {
    const AIxamPage = module.default

    root.removeAttribute("style")
    root.replaceChildren()

    render(() => <AIxamPage />, root)
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : String(error)

    console.error("AI-xam preview failed:", error)

    root.style.cssText =
      "min-height:100vh;padding:24px;background:#101827;color:#ffb4b4;font-family:system-ui"

    root.textContent = `AI-xam could not start: ${message}`
  })

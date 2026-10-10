import { render } from "solid-js/web"
import "../../index.css"
import AIxamPage from "./ai-xam-page"

const root = document.getElementById("root")

if (!root) {
  throw new Error("AI-xam preview root was not found")
}

render(() => <AIxamPage />, root)

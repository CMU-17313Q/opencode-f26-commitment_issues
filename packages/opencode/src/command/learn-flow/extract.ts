import { fileURLToPath } from "url"
import { Language, Parser } from "web-tree-sitter"
import { lazy } from "@/util/lazy"

// Same wasm resolution as src/tool/shell.ts.
const resolveWasm = (asset: string) => {
  if (asset.startsWith("file://")) return fileURLToPath(asset)
  if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
  const url = new URL(asset, import.meta.url)
  return fileURLToPath(url)
}

const parser = lazy(async () => {
  const { default: treeWasm } = await import("web-tree-sitter/tree-sitter.wasm" as string, {
    with: { type: "wasm" },
  })
  const treePath = resolveWasm(treeWasm)
  await Parser.init({
    locateFile() {
      return treePath
    },
  })
  const { default: tsWasm } = await import("tree-sitter-typescript/tree-sitter-typescript.wasm" as string, {
    with: { type: "wasm" },
  })
  const language = await Language.load(resolveWasm(tsWasm))
  const ts = new Parser()
  ts.setLanguage(language)
  return ts
})

export async function parseSource(source: string) {
  const tree = (await parser()).parse(source)
  if (!tree) throw new Error("Failed to parse TypeScript source")
  return tree
}

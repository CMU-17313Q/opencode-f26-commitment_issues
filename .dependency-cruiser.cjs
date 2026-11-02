// dependency-cruiser config for the Code Quality / Static Analysis CI check
// (.github/workflows/dependency-cruiser.yml). It checks how modules import each other.
// Docs: https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
//
// Run locally:   bash .github/dependency-cruiser/run.sh
// Rule tests:    bash .github/dependency-cruiser/test-rules.sh
//
// Violations that already existed when the check was added are recorded in
// .github/dependency-cruiser/known-violations.*.json, so only new ones fail CI.
// Paths in rules are relative to the package being cruised (packages/app or packages/opencode).

const TEST_FILE = "(^|/)(test|__tests__|e2e)/|\\.(test|spec)\\.[cm]?[jt]sx?$|(^|/)test-fakes\\.[jt]s$|\\.fixtures\\.[jt]s$"

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Import cycles make module init order fragile (undefined at import time) and tie modules together so they can't be tested or changed alone. Break the cycle by moving the shared part into its own module.",
      from: { path: "(.+)" },
      to: {
        circular: true,
        // `export * as X from "./self"` is opencode's namespace pattern, not a real cycle.
        pathNot: "^$1$",
        // `import type` is erased at runtime, so it cannot cause an init-order bug.
        viaOnly: { dependencyTypesNot: ["type-only"] },
      },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment:
        "This import points at a file or package that does not exist, or at a package this workspace does not declare in its package.json. Fix the path or add the package.",
      from: {},
      // Bun installs isolated (no hoisting), so an undeclared package fails to resolve and is caught here too.
      // bun:* modules are runtime builtins dependency-cruiser does not know about; *.gen.ts are build outputs.
      to: { couldNotResolve: true, pathNot: ["^bun:", "\\.gen\\.ts$"] },
    },
    {
      name: "not-to-test",
      severity: "error",
      comment: "Production code must not import tests, test fakes or fixtures: they would ship in the bundle.",
      from: { pathNot: TEST_FILE },
      to: { path: TEST_FILE },
    },

    // Learning Companion layering. Pure logic must not reach up into the UI or
    // the AI client, so it stays unit- and property-testable (fast-check check).
    {
      name: "ai-xam-domain-is-pure",
      severity: "error",
      comment: "ai-xam/domain holds pure exam logic. It must not import components, services, the AI client or Solid.",
      from: { path: "^src/pages/ai-xam/domain/" },
      to: {
        pathNot: "^src/pages/ai-xam/domain/",
        dependencyTypesNot: ["core"],
      },
    },
    {
      name: "ai-xam-no-ui-below-components",
      severity: "error",
      comment: "ai-xam services and ai modules sit below the UI. They must not import components or pages.",
      from: { path: "^src/pages/ai-xam/(services|ai)/" },
      to: { path: ["^src/pages/ai-xam/components/", "\\.tsx$"] },
    },
    {
      name: "focus-session-controller-no-ui",
      severity: "error",
      comment: "The focus-session controller is UI-free (it talks to the UI through ports.ts). It must not import components or .tsx files.",
      from: { path: "^src/pages/home/focus-session/controller/" },
      to: { path: ["^src/pages/home/focus-session/components/", "\\.tsx$"] },
    },
    {
      name: "learn-flow-no-session",
      severity: "error",
      comment: "learn-flow graph extraction and rendering are pure. They must not import the session, server or tool layers.",
      from: { path: "^src/command/learn-flow/" },
      to: { path: "^src/(session|server|tool)/" },
    },

    {
      name: "no-orphans",
      severity: "warn",
      comment: "This module is not imported by anything and imports nothing. It is likely dead code. Reported only, never blocks.",
      from: {
        orphan: true,
        pathNot: [TEST_FILE, "\\.d\\.ts$", "(^|/)preview\\.tsx?$", "\\.(json|txt|css|html)$"],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: ["node_modules", "^\\.\\./"] },
    exclude: { path: ["node_modules", "\\.d\\.ts$"] },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "bun", "browser", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".d.ts"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}

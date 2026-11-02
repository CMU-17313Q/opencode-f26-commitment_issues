## Forbidden dependency check - results

### :chart_with_upwards_trend: Summary

**563** modules&nbsp;&nbsp;&nbsp;&nbsp;**2565** dependencies&nbsp;&nbsp;&nbsp;&nbsp;**0** errors&nbsp;&nbsp;&nbsp;&nbsp;**0** warnings&nbsp;&nbsp;&nbsp;&nbsp;**0** informational&nbsp;&nbsp;&nbsp;&nbsp;**20** ignored&nbsp;&nbsp;&nbsp;&nbsp;**17** stale entries in baseline


|rule|violations|ignored|explanation
|:---|:---:|:---:|:---|
|:exclamation:&nbsp;_no-circular_|**0**|**18**|Import cycles make module init order fragile (undefined at import time) and tie modules together so they can't be tested or changed alone. Break the cycle by moving the shared part into its own module.|
|:warning:&nbsp;_no-orphans_|**0**|**2**|This module is not imported by anything and imports nothing. It is likely dead code. Reported only, never blocks.|


### :fire: All violations

<details><summary>Violations found - click to expand</summary>

|violated rule|module|to|
|:---|:---|:---|
|:see_no_evil:&nbsp;_no-circular_|src/agent/agent.ts|src/plugin/index.ts|
|:see_no_evil:&nbsp;_no-circular_|src/effect/app-runtime.ts|src/control-plane/workspace.ts|
|:see_no_evil:&nbsp;_no-circular_|src/effect/app-runtime.ts|src/provider/auth.ts|
|:see_no_evil:&nbsp;_no-circular_|src/provider/auth.ts|src/plugin/index.ts|
|:see_no_evil:&nbsp;_no-circular_|src/provider/provider.ts|src/plugin/index.ts|
|:see_no_evil:&nbsp;_no-circular_|src/server/routes/instance/httpapi/groups/provider.ts|src/provider/auth.ts|
|:see_no_evil:&nbsp;_no-circular_|src/server/routes/instance/httpapi/handlers/provider.ts|src/provider/auth.ts|
|:see_no_evil:&nbsp;_no-circular_|src/server/routes/instance/httpapi/server.ts|src/plugin/index.ts|
|:see_no_evil:&nbsp;_no-circular_|src/server/routes/instance/httpapi/server.ts|src/plugin/pty-environment.ts|
|:see_no_evil:&nbsp;_no-circular_|src/server/routes/instance/httpapi/server.ts|src/provider/auth.ts|
|:see_no_evil:&nbsp;_no-circular_|src/session/compaction.ts|src/plugin/index.ts|
|:see_no_evil:&nbsp;_no-circular_|src/session/llm.ts|src/plugin/index.ts|
|:see_no_evil:&nbsp;_no-circular_|src/session/processor.ts|src/plugin/index.ts|
|:see_no_evil:&nbsp;_no-circular_|src/session/prompt.ts|src/agent/agent.ts|
|:see_no_evil:&nbsp;_no-circular_|src/session/prompt.ts|src/plugin/index.ts|
|:see_no_evil:&nbsp;_no-circular_|src/session/prompt.ts|src/session/compaction.ts|
|:see_no_evil:&nbsp;_no-circular_|src/session/prompt.ts|src/session/llm.ts|
|:see_no_evil:&nbsp;_no-circular_|src/tool/registry.ts|src/plugin/index.ts|
|:see_no_evil:&nbsp;_no-orphans_|src/util/defer.ts||
|:see_no_evil:&nbsp;_no-orphans_|src/util/signal.ts||


</details>

### :ghost: Stale entries in the baseline

<details><summary>Stale violations in the baseline - click to expand</summary>

These violations are in the baseline (typically `.dependency-cruiser-known-violations.json`) but don't match any real violations anymore, e.g. because they were fixed in the meantime. You can remove them with dependency-cruiser's [`--baseline --baseline-mode shrink-only`](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md#--baseline-create-or-update-a-known-violations-baseline) command line options.

|violated rule|module|to|
|:---|:---|:---|
|:exclamation:&nbsp;_no-circular_|src/agent/agent.ts|src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/public.ts &rightarrow;<br/>src/server/routes/instance/httpapi/api.ts &rightarrow;<br/>src/server/routes/instance/httpapi/groups/config.ts &rightarrow;<br/>src/server/routes/instance/httpapi/middleware/instance-context.ts &rightarrow;<br/>src/server/routes/instance/httpapi/middleware/workspace-routing.ts &rightarrow;<br/>src/control-plane/workspace.ts &rightarrow;<br/>src/control-plane/adapters/index.ts &rightarrow;<br/>src/control-plane/adapters/worktree.ts &rightarrow;<br/>src/effect/app-runtime.ts &rightarrow;<br/>src/agent/agent.ts|
|:exclamation:&nbsp;_no-circular_|src/effect/app-runtime.ts|src/control-plane/workspace.ts &rightarrow;<br/>src/control-plane/adapters/index.ts &rightarrow;<br/>src/control-plane/adapters/worktree.ts &rightarrow;<br/>src/effect/app-runtime.ts|
|:exclamation:&nbsp;_no-circular_|src/effect/app-runtime.ts|src/provider/auth.ts &rightarrow;<br/>src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/public.ts &rightarrow;<br/>src/server/routes/instance/httpapi/api.ts &rightarrow;<br/>src/server/routes/instance/httpapi/groups/config.ts &rightarrow;<br/>src/server/routes/instance/httpapi/middleware/instance-context.ts &rightarrow;<br/>src/server/routes/instance/httpapi/middleware/workspace-routing.ts &rightarrow;<br/>src/control-plane/workspace.ts &rightarrow;<br/>src/control-plane/adapters/index.ts &rightarrow;<br/>src/control-plane/adapters/worktree.ts &rightarrow;<br/>src/effect/app-runtime.ts|
|:exclamation:&nbsp;_no-circular_|src/provider/auth.ts|src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/server.ts &rightarrow;<br/>src/provider/auth.ts|
|:exclamation:&nbsp;_no-circular_|src/provider/provider.ts|src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/public.ts &rightarrow;<br/>src/server/routes/instance/httpapi/api.ts &rightarrow;<br/>src/server/routes/instance/httpapi/groups/config.ts &rightarrow;<br/>src/provider/provider.ts|
|:exclamation:&nbsp;_no-circular_|src/server/routes/instance/httpapi/groups/provider.ts|src/provider/auth.ts &rightarrow;<br/>src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/public.ts &rightarrow;<br/>src/server/routes/instance/httpapi/api.ts &rightarrow;<br/>src/server/routes/instance/httpapi/groups/provider.ts|
|:exclamation:&nbsp;_no-circular_|src/server/routes/instance/httpapi/handlers/provider.ts|src/provider/auth.ts &rightarrow;<br/>src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/handlers/provider.ts|
|:exclamation:&nbsp;_no-circular_|src/server/routes/instance/httpapi/server.ts|src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/server.ts|
|:exclamation:&nbsp;_no-circular_|src/server/routes/instance/httpapi/server.ts|src/plugin/pty-environment.ts &rightarrow;<br/>src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/server.ts|
|:exclamation:&nbsp;_no-circular_|src/session/compaction.ts|src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/server.ts &rightarrow;<br/>src/session/compaction.ts|
|:exclamation:&nbsp;_no-circular_|src/session/llm.ts|src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/server.ts &rightarrow;<br/>src/session/llm.ts|
|:exclamation:&nbsp;_no-circular_|src/session/processor.ts|src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/server.ts &rightarrow;<br/>src/session/processor.ts|
|:exclamation:&nbsp;_no-circular_|src/session/prompt.ts|src/agent/agent.ts &rightarrow;<br/>src/plugin/index.ts &rightarrow;<br/>src/control-plane/adapters/index.ts &rightarrow;<br/>src/control-plane/adapters/worktree.ts &rightarrow;<br/>src/effect/app-runtime.ts &rightarrow;<br/>src/session/prompt.ts|
|:exclamation:&nbsp;_no-circular_|src/session/prompt.ts|src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/server.ts &rightarrow;<br/>src/session/prompt.ts|
|:exclamation:&nbsp;_no-circular_|src/session/prompt.ts|src/session/compaction.ts &rightarrow;<br/>src/plugin/index.ts &rightarrow;<br/>src/control-plane/adapters/index.ts &rightarrow;<br/>src/control-plane/adapters/worktree.ts &rightarrow;<br/>src/effect/app-runtime.ts &rightarrow;<br/>src/session/prompt.ts|
|:exclamation:&nbsp;_no-circular_|src/session/prompt.ts|src/session/llm.ts &rightarrow;<br/>src/plugin/index.ts &rightarrow;<br/>src/control-plane/adapters/index.ts &rightarrow;<br/>src/control-plane/adapters/worktree.ts &rightarrow;<br/>src/effect/app-runtime.ts &rightarrow;<br/>src/session/prompt.ts|
|:exclamation:&nbsp;_no-circular_|src/tool/registry.ts|src/plugin/index.ts &rightarrow;<br/>src/server/server.ts &rightarrow;<br/>src/server/routes/instance/httpapi/server.ts &rightarrow;<br/>src/tool/registry.ts|


</details>

---
[dependency-cruiser@18.7.0](https://www.github.com/sverweij/dependency-cruiser) / 2026-11-02T09:14:05.763Z


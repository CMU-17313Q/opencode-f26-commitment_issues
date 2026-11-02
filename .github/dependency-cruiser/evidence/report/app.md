## Forbidden dependency check - results

### :chart_with_upwards_trend: Summary

**710** modules&nbsp;&nbsp;&nbsp;&nbsp;**2591** dependencies&nbsp;&nbsp;&nbsp;&nbsp;**0** errors&nbsp;&nbsp;&nbsp;&nbsp;**0** warnings&nbsp;&nbsp;&nbsp;&nbsp;**0** informational&nbsp;&nbsp;&nbsp;&nbsp;**18** ignored&nbsp;&nbsp;&nbsp;&nbsp;**7** stale entries in baseline


|rule|violations|ignored|explanation
|:---|:---:|:---:|:---|
|:exclamation:&nbsp;_no-circular_|**0**|**17**|Import cycles make module init order fragile (undefined at import time) and tie modules together so they can't be tested or changed alone. Break the cycle by moving the shared part into its own module.|
|:exclamation:&nbsp;_not-to-unresolvable_|**0**|**1**|This import points at a file or package that does not exist, or at a package this workspace does not declare in its package.json. Fix the path or add the package.|


### :fire: All violations

<details><summary>Violations found - click to expand</summary>

|violated rule|module|to|
|:---|:---|:---|
|:see_no_evil:&nbsp;_no-circular_|src/components/dialog-settings.tsx|src/components/settings-general.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/components/settings-general.tsx|src/components/settings-v2/index.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/components/settings-v2/dialog-settings-v2.tsx|src/components/settings-v2/general.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/components/settings-v2/general.tsx|src/components/dialog-settings.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/components/settings-v2/index.tsx|src/components/settings-v2/dialog-settings-v2.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/context/global-sync/bootstrap.ts|src/context/server-sync.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/context/global-sync/child-store.ts|src/context/server-sync.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/context/global.tsx|src/context/server-sdk.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/context/global.tsx|src/context/server-sync.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/context/platform.tsx|src/context/server.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/context/server-sdk.tsx|src/context/global.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/context/server-sync.tsx|src/context/global-sync/bootstrap.ts|
|:see_no_evil:&nbsp;_no-circular_|src/context/server-sync.tsx|src/context/global-sync/child-store.ts|
|:see_no_evil:&nbsp;_no-circular_|src/context/server-sync.tsx|src/context/global.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/context/server-sync.tsx|src/context/server-sdk.tsx|
|:see_no_evil:&nbsp;_no-circular_|src/context/server.tsx|src/utils/persist.ts|
|:see_no_evil:&nbsp;_no-circular_|src/utils/persist.ts|src/context/platform.tsx|
|:see_no_evil:&nbsp;_not-to-unresolvable_|src/pages/session/composer/todo-panel-motion.stories.tsx|@/context/global-sync|


</details>

### :ghost: Stale entries in the baseline

<details><summary>Stale violations in the baseline - click to expand</summary>

These violations are in the baseline (typically `.dependency-cruiser-known-violations.json`) but don't match any real violations anymore, e.g. because they were fixed in the meantime. You can remove them with dependency-cruiser's [`--baseline --baseline-mode shrink-only`](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md#--baseline-create-or-update-a-known-violations-baseline) command line options.

|violated rule|module|to|
|:---|:---|:---|
|:exclamation:&nbsp;_no-circular_|src/components/dialog-settings.tsx|src/components/settings-general.tsx &rightarrow;<br/>src/components/settings-v2/index.tsx &rightarrow;<br/>src/components/settings-v2/dialog-settings-v2.tsx &rightarrow;<br/>src/components/settings-v2/general.tsx &rightarrow;<br/>src/components/dialog-settings.tsx|
|:exclamation:&nbsp;_no-circular_|src/context/global-sync/bootstrap.ts|src/context/server-sync.tsx &rightarrow;<br/>src/context/global-sync/bootstrap.ts|
|:exclamation:&nbsp;_no-circular_|src/context/global-sync/child-store.ts|src/context/server-sync.tsx &rightarrow;<br/>src/context/global-sync/child-store.ts|
|:exclamation:&nbsp;_no-circular_|src/context/global.tsx|src/context/server-sdk.tsx &rightarrow;<br/>src/context/global.tsx|
|:exclamation:&nbsp;_no-circular_|src/context/global.tsx|src/context/server-sync.tsx &rightarrow;<br/>src/context/global.tsx|
|:exclamation:&nbsp;_no-circular_|src/context/platform.tsx|src/context/server.tsx &rightarrow;<br/>src/utils/persist.ts &rightarrow;<br/>src/context/platform.tsx|
|:exclamation:&nbsp;_no-circular_|src/context/server-sync.tsx|src/context/server-sdk.tsx &rightarrow;<br/>src/context/global.tsx &rightarrow;<br/>src/context/server-sync.tsx|


</details>

---
[dependency-cruiser@18.7.0](https://www.github.com/sverweij/dependency-cruiser) / 2026-11-02T09:13:59.730Z


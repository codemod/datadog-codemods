---
'@codemod/dd-trace-js-v6-add-link-object-argument': minor
'@codemod/dd-trace-js-v6-migration-recipe': minor
'@codemod/dd-trace-js-v6-flatten-ingestion-options': minor
'@codemod/dd-trace-js-v6-move-exp-appsec-options': minor
'@codemod/dd-trace-js-v6-move-exp-iast-options': minor
'@codemod/dd-trace-js-v6-rename-b3-style': minor
'@codemod/dd-trace-js-v6-rename-plugin-list-options': minor
'@codemod/dd-trace-js-v6-rename-profiling-env-vars': minor
'@codemod/dd-trace-js-v6-rename-runtime-id-env-var': minor
---

Publish all dd-trace-js 5→6 codemods under the **`@codemod`** scope using **`@codemod/dd-trace-js-v6-<slug>`** (SDK + **destination** major **v6** + codemod slug). Update docs, workflow sources, and workspace `pnpm` filters to match. Fix recipe metadata test to satisfy lint. Use **`dd-trace-js`** (not `dd-trace`) in `codemod.yaml` registry keywords for discoverability. Add **`apm`**, **`nodejs`**, and **`v6`** to each package's `codemod.yaml` `keywords` list. Abbreviate **`experimental` → `exp`** in the IAST and AppSec package names so scoped names stay within the registry **50-character** limit.

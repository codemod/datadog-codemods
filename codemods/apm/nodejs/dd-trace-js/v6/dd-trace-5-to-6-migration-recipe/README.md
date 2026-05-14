# dd-trace-5-to-6-migration-recipe

Runs the implemented `dd-trace-js` 5.0 to 6.0 codemods in sequence.

This is the place for broad migration orchestration and cross-cutting review.
Individual codemod packages remain atomic.

## Codemods

1. `dd-trace-5-to-6-add-link-object-argument`
2. `dd-trace-5-to-6-rename-plugin-list-options`
3. `dd-trace-5-to-6-move-experimental-iast-options`
4. `dd-trace-5-to-6-move-experimental-appsec-options`
5. `dd-trace-5-to-6-flatten-ingestion-options`
6. `dd-trace-5-to-6-rename-profiling-env-vars`
7. `dd-trace-5-to-6-rename-runtime-id-env-var`
8. `dd-trace-5-to-6-rename-b3-style`

## AI Review

The recipe has an optional final AI review step for unresolved migration blockers
that span multiple codemods or file types. It is report-only and must not edit
files.

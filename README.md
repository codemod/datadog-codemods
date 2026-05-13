# Datadog Codemods

JSSG codemods for Datadog JavaScript SDK migrations.

This repository currently targets the `dd-trace-js` 5.0 to 6.0 migration from
the Datadog [migration guide](https://github.com/DataDog/dd-trace-js/blob/master/MIGRATING.md#50-to-60-unreleased).

All codemods are authored as Codemod packages under `codemods/<slug>/`. Each
package owns its metadata, workflow, implementation, README, and fixtures.
Package metadata assumes publication from
`https://github.com/codemod/datadog-codemods`.

## Usage

Run the full migration recipe:

```bash
npx codemod dd-trace-5-to-6-migration-recipe --target <path>
```

Run an individual codemod after publish:

```bash
npx codemod <codemod-name> --target <path>
```

Use the package names below as `<codemod-name>`.

All packages are expected to be available in the
[Codemod Registry](https://app.codemod.com/registry?q=dd-trace-5-to-6).

## Available Codemods

#### `dd-trace-5-to-6-migration-recipe`

Runs the implemented dd-trace 5.0 to 6.0 codemods in sequence, then can run a
final report-only AI review for unresolved migration blockers.

```bash
npx codemod dd-trace-5-to-6-migration-recipe --target <path>
```

Optional recipe parameters:

- `--param run_ai_review=true` enables report-only AI review steps in nested
  IAST and AppSec codemods.
- `--param run_ai_config_step=true` enables AI config-file steps in nested env
  var and propagation-style codemods.
- `--param run_final_ai_review=true` enables the final report-only recipe
  review.

See
[dd-trace-5-to-6-migration-recipe](https://app.codemod.com/registry/dd-trace-5-to-6-migration-recipe).

#### `dd-trace-5-to-6-add-link-object-argument`

Rewrites `Span.addLink(context, attributes)` to
`Span.addLink({ context, attributes })`.

```bash
npx codemod dd-trace-5-to-6-add-link-object-argument --target <path>
```

See
[dd-trace-5-to-6-add-link-object-argument](https://app.codemod.com/registry/dd-trace-5-to-6-add-link-object-argument).

#### `dd-trace-5-to-6-rename-plugin-list-options`

Renames `whitelist` / `blacklist` to `allowlist` / `blocklist` for Datadog
`http`, `ioredis`, `iovalkey`, and `redis` plugin configs.

```bash
npx codemod dd-trace-5-to-6-rename-plugin-list-options --target <path>
```

See
[dd-trace-5-to-6-rename-plugin-list-options](https://app.codemod.com/registry/dd-trace-5-to-6-rename-plugin-list-options).

#### `dd-trace-5-to-6-move-experimental-iast-options`

Moves safe `experimental.iast.*` programmatic options to top-level `iast.*`.
Skips `securityControlsConfiguration`, which is env-only in v6.

```bash
npx codemod dd-trace-5-to-6-move-experimental-iast-options --target <path>
```

See
[dd-trace-5-to-6-move-experimental-iast-options](https://app.codemod.com/registry/dd-trace-5-to-6-move-experimental-iast-options).

Optional report-only AI review for skipped security controls:

```bash
npx codemod dd-trace-5-to-6-move-experimental-iast-options \
  --target <path> \
  --param run_ai_review=true
```

#### `dd-trace-5-to-6-move-experimental-appsec-options`

Moves safe `experimental.appsec.*` programmatic options to top-level `appsec.*`
and rewrites `experimental.appsec.standalone.enabled` to `apmTracingEnabled`.
Skips options that must move to Datadog UI / Remote Configuration.

```bash
npx codemod dd-trace-5-to-6-move-experimental-appsec-options --target <path>
```

See
[dd-trace-5-to-6-move-experimental-appsec-options](https://app.codemod.com/registry/dd-trace-5-to-6-move-experimental-appsec-options).

Optional report-only AI review for skipped AppSec Remote Configuration options:

```bash
npx codemod dd-trace-5-to-6-move-experimental-appsec-options \
  --target <path> \
  --param run_ai_review=true
```

#### `dd-trace-5-to-6-flatten-ingestion-options`

Flattens `ingestion.sampleRate` and `ingestion.rateLimit` to top-level
`sampleRate` and `rateLimit`.

```bash
npx codemod dd-trace-5-to-6-flatten-ingestion-options --target <path>
```

See
[dd-trace-5-to-6-flatten-ingestion-options](https://app.codemod.com/registry/dd-trace-5-to-6-flatten-ingestion-options).

#### `dd-trace-5-to-6-rename-profiling-env-vars`

Renames profiling env var aliases removed in v6 inside JS/TS source:

- `DD_PROFILING_EXPERIMENTAL_CODEHOTSPOTS_ENABLED`
- `DD_PROFILING_EXPERIMENTAL_CPU_ENABLED`
- `DD_PROFILING_EXPERIMENTAL_ENDPOINT_COLLECTION_ENABLED`
- `DD_PROFILING_EXPERIMENTAL_TIMELINE_ENABLED`

```bash
npx codemod dd-trace-5-to-6-rename-profiling-env-vars --target <path>
```

See
[dd-trace-5-to-6-rename-profiling-env-vars](https://app.codemod.com/registry/dd-trace-5-to-6-rename-profiling-env-vars).

Optional AI config-file step for exact active occurrences in `.env`,
Dockerfile, YAML, shell, CI, and deployment files:

```bash
npx codemod dd-trace-5-to-6-rename-profiling-env-vars \
  --target <path> \
  --param run_ai_config_step=true
```

#### `dd-trace-5-to-6-rename-runtime-id-env-var`

Renames `DD_TRACE_EXPERIMENTAL_RUNTIME_ID_ENABLED` to
`DD_RUNTIME_METRICS_RUNTIME_ID_ENABLED` inside JS/TS source.

```bash
npx codemod dd-trace-5-to-6-rename-runtime-id-env-var --target <path>
```

See
[dd-trace-5-to-6-rename-runtime-id-env-var](https://app.codemod.com/registry/dd-trace-5-to-6-rename-runtime-id-env-var).

Optional AI config-file step for exact active occurrences in `.env`,
Dockerfile, YAML, shell, CI, and deployment files:

```bash
npx codemod dd-trace-5-to-6-rename-runtime-id-env-var \
  --target <path> \
  --param run_ai_config_step=true
```

#### `dd-trace-5-to-6-rename-b3-style`

Renames exact propagation style values from `"b3 single header"` to `"b3"` in
JS/TS Datadog configuration source.

```bash
npx codemod dd-trace-5-to-6-rename-b3-style --target <path>
```

See
[dd-trace-5-to-6-rename-b3-style](https://app.codemod.com/registry/dd-trace-5-to-6-rename-b3-style).

Optional AI config-file step for exact active `DD_TRACE_PROPAGATION_STYLE`
occurrences in `.env`, Dockerfile, YAML, shell, CI, and deployment files:

```bash
npx codemod dd-trace-5-to-6-rename-b3-style \
  --target <path> \
  --param run_ai_config_step=true
```

## Coverage

| Migration guide item | Automation |
| --- | --- |
| `Span.addLink(spanContext, attributes)` removed | `dd-trace-5-to-6-add-link-object-argument` |
| Plugin `whitelist` / `blacklist` options removed from types | `dd-trace-5-to-6-rename-plugin-list-options` |
| `experimental.iast` configuration removed | `dd-trace-5-to-6-move-experimental-iast-options` |
| `iast.securityControlsConfiguration` is env-only | Report-only AI review; manual move to `DD_IAST_SECURITY_CONTROLS_CONFIGURATION` |
| AppSec extended-data-collection programmatic config removed | Report-only AI review; manual Datadog UI / Remote Configuration move |
| `experimental.appsec` configuration removed | `dd-trace-5-to-6-move-experimental-appsec-options` |
| `ingestion` option removed | `dd-trace-5-to-6-flatten-ingestion-options` |
| Profiling experimental env aliases removed | `dd-trace-5-to-6-rename-profiling-env-vars` |
| `DD_TRACE_EXPERIMENTAL_RUNTIME_ID_ENABLED` removed | `dd-trace-5-to-6-rename-runtime-id-env-var` |
| `"b3 single header"` renamed to `"b3"` | `dd-trace-5-to-6-rename-b3-style` |
| `experimental.b3` removed | Issue drafted; deterministic rewrite deferred |
| `DD_TRACE_STARTUP_LOGS` defaults to `true` | Manual operational decision |

## Safety Model

- JS/TS transforms are AST-based JSSG codemods.
- Programmatic dd-trace config rewrites require a local `dd-trace` binding or a
  direct `require("dd-trace")` call.
- Env var codemods only rewrite exact `process.env` references and JS/TS object
  keys by default.
- Comments, arbitrary prose, and unrelated string literals are left unchanged.
- AI steps are disabled by default and are limited to either report-only review
  or exact active config-file occurrences described in the workflow prompt.
- AI workflow steps do not require a direct `LLM_API_KEY` for local testing.
  In raw CLI runs without a provider key, Codemod emits `[AI INSTRUCTIONS]` for
  the parent agent or harness to handle.

## Development

```bash
pnpm install
pnpm run test
pnpm run check-types
pnpm run ci
```

Run one package:

```bash
pnpm --filter dd-trace-5-to-6-add-link-object-argument test
pnpm --filter dd-trace-5-to-6-add-link-object-argument check-types
```

Run a JSSG transform directly while developing:

```bash
pnpm dlx codemod@latest jssg run --language tsx --allow-dirty \
  --target samples/dd-trace-v5-app/src/tracing.ts \
  codemods/add-link-object-argument/scripts/codemod.ts
```

## Issue Backlog

GitHub issue drafts live in [issues](./issues). The index in
[issues/README.md](./issues/README.md) lists the issues to open for implemented
codemods, deferred codemods, and manual migration checks.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

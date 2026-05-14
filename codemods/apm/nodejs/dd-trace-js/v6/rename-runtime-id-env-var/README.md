# dd-trace-5-to-6-rename-runtime-id-env-var

Renames `DD_TRACE_EXPERIMENTAL_RUNTIME_ID_ENABLED` to
`DD_RUNTIME_METRICS_RUNTIME_ID_ENABLED` in JS/TS source.

## Safety

This package updates `process.env.<VAR>`, `process.env["<VAR>"]`, and JS/TS
object keys named exactly like the removed env var. It does not rewrite
comments, arbitrary string literals, `.env`, Dockerfile, shell, or YAML files.

The workflow includes an optional AI config step for exact active configuration
occurrences in non-JS files. It is disabled by default.

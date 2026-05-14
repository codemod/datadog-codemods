# @codemod/dd-trace-js-v6-rename-profiling-env-vars

Renames Datadog profiling environment variable aliases removed in dd-trace v6:

- `DD_PROFILING_EXPERIMENTAL_CODEHOTSPOTS_ENABLED` to `DD_PROFILING_CODEHOTSPOTS_ENABLED`
- `DD_PROFILING_EXPERIMENTAL_CPU_ENABLED` to `DD_PROFILING_CPU_ENABLED`
- `DD_PROFILING_EXPERIMENTAL_ENDPOINT_COLLECTION_ENABLED` to `DD_PROFILING_ENDPOINT_COLLECTION_ENABLED`
- `DD_PROFILING_EXPERIMENTAL_TIMELINE_ENABLED` to `DD_PROFILING_TIMELINE_ENABLED`

## Safety

This package updates `process.env.<VAR>`, `process.env["<VAR>"]`, and JS/TS
object keys named exactly like the removed env vars. It does not rewrite
comments, arbitrary string literals, `.env`, Dockerfile, shell, or YAML files.

The workflow includes an optional AI config step for exact active configuration
occurrences in non-JS files. It is disabled by default.

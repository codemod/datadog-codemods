# dd-trace-5-to-6-rename-b3-style

Renames the legacy propagation style value `"b3 single header"` to `"b3"` in
JS/TS Datadog configuration source.

## Safety

The transform only updates exact string values in these contexts:

- `propagationStyle`
- `DD_TRACE_PROPAGATION_STYLE`
- assignments to `process.env.DD_TRACE_PROPAGATION_STYLE`

Programmatic `propagationStyle` rewrites must be inside `.init(...)` called
through a local `dd-trace` binding or direct `require("dd-trace")` call. Env-var
contexts are keyed by exact Datadog env var names. Comments and unrelated string
literals are left unchanged.

The workflow includes an optional AI config step for exact active configuration
occurrences in non-JS files. It is disabled by default.

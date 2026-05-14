# @codemod/dd-trace-js-v6-move-experimental-appsec-options

Moves removed `experimental.appsec.*` programmatic aliases to top-level
`appsec.*`, and rewrites `experimental.appsec.standalone.enabled` to
`apmTracingEnabled`.

## Safety

The transform only updates object literals passed directly to `.init(...)`
through a local `dd-trace` binding or direct `require("dd-trace")` call. It
skips when:

- top-level `appsec` or `apmTracingEnabled` would conflict
- `experimental.appsec` is not an object literal
- `appsec.extendedHeadersCollection` is present
- `appsec.rasp.bodyCollection` is present
- `standalone` does not have the exact `{ enabled: <value> }` shape

Extended header collection and RASP body collection must be configured through
Datadog UI and Remote Configuration in dd-trace v6.

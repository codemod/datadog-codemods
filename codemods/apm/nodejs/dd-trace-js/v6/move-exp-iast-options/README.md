# @codemod/dd-trace-js-v6-move-exp-iast-options

Moves removed `experimental.iast.*` programmatic aliases to the canonical
top-level `iast.*` object.

## Safety

The transform only updates object literals passed directly to `.init(...)`
through a local `dd-trace` binding or direct `require("dd-trace")` call. It
skips when:

- a top-level `iast` option already exists
- `experimental.iast.securityControlsConfiguration` is present
- `experimental.iast` is not an object literal

`securityControlsConfiguration` is env-only in dd-trace v6 and should be moved
manually to `DD_IAST_SECURITY_CONTROLS_CONFIGURATION`.

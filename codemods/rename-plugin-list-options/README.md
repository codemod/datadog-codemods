# dd-trace-5-to-6-rename-plugin-list-options

Renames removed Datadog plugin option aliases:

- `whitelist` to `allowlist`
- `blacklist` to `blocklist`

The transform only applies to the v6-affected plugin interfaces: `http`,
`ioredis`, `iovalkey`, and `redis`.

## Supported Shapes

```ts
tracer.use("http", { whitelist: ["/health"] });

tracer.init({
  plugins: {
    redis: { blacklist: ["internal"] }
  }
});
```

The transform only updates plugin config reached through a local `dd-trace`
binding or direct `require("dd-trace")` call. Generic object properties named
`whitelist` or `blacklist` are left unchanged.

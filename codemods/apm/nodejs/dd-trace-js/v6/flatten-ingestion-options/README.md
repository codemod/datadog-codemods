# dd-trace-5-to-6-flatten-ingestion-options

Flattens the removed `ingestion` wrapper in dd-trace v6:

```ts
tracer.init({
  ingestion: { sampleRate: 0.5, rateLimit: 100 },
})
```

becomes:

```ts
tracer.init({
  sampleRate: 0.5,
  rateLimit: 100,
})
```

## Safety

The transform only updates object literals passed directly to `.init(...)`
through a local `dd-trace` binding or direct `require("dd-trace")` call. It
skips objects with existing top-level `sampleRate` or `rateLimit` fields, and
it skips `ingestion` wrappers containing unsupported keys.

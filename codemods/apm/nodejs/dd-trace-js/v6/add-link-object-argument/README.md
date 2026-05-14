# @codemod/dd-trace-js-v6-add-link-object-argument

Rewrites the Datadog v5 `Span.addLink(context, attributes)` overload to the v6
single-argument object shape:

```ts
span.addLink({ context: otherSpan.context(), attributes: { foo: 'bar' } })
```

## Safety

The transform rewrites `.addLink(...)` calls with exactly two positional
arguments only when the receiver is statically tied to Datadog:

- a direct `tracer.scope().active()` or `tracer.startSpan(...)` chain
- a local variable initialized from one of those factories
- a parameter typed as `Span` imported from `dd-trace`

Existing object-form calls, unrelated `addLink` methods, and calls with a
different arity are left unchanged.

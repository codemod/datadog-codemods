import tracer, { type Span as DatadogSpan } from "dd-trace";

tracer.scope().active()?.addLink({ context: context, attributes: attributes });
tracer.startSpan("operation").addLink({ context: context, attributes: attributes });

function link(span: DatadogSpan) {
  span.addLink({ context: context, attributes: attributes });
}

import tracer, { type Span as DatadogSpan } from "dd-trace";

tracer.scope().active()?.addLink(context, attributes);
tracer.startSpan("operation").addLink(context, attributes);

function link(span: DatadogSpan) {
  span.addLink(context, attributes);
}

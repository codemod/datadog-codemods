import tracer from "dd-trace";

const span = tracer.startSpan("outer");

function link(span: { addLink(context: unknown, attributes: unknown): void }) {
  span.addLink(context, attributes);
}

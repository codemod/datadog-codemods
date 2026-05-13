import tracer from "dd-trace";

const span = getExternalSpan();
span.addLink(context, attributes);

const ddSpan = tracer.scope().active();
ddSpan?.addLink({ context, attributes });

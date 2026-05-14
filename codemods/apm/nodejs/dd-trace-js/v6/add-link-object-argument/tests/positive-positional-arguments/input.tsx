import tracer from "dd-trace";

const span = tracer.scope().active();
const otherSpan = tracer.scope().active();

span?.addLink(otherSpan!.context(), { foo: "bar" });
span?.addLink(getContext(), buildAttributes());

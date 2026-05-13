import tracer from "dd-trace";

const span = tracer.scope().active();
const otherSpan = tracer.scope().active();

span?.addLink({ context: otherSpan!.context(), attributes: { foo: "bar" } });
span?.addLink({ context: getContext(), attributes: buildAttributes() });

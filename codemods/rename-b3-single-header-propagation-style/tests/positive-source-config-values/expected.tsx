import tracer from "dd-trace";

tracer.init({
  propagationStyle: ["datadog", "b3"],
  env: {
    DD_TRACE_PROPAGATION_STYLE: "b3"
  },
  note: "b3 single header"
});

process.env.DD_TRACE_PROPAGATION_STYLE = "b3";

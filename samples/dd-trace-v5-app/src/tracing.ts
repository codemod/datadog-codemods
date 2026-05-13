import tracer from "dd-trace";

tracer.init({
  service: "orders-api",
  propagationStyle: ["datadog", "b3 single header"],
  ingestion: {
    sampleRate: 0.5,
    rateLimit: 100
  },
  experimental: {
    b3: true,
    iast: {
      enabled: true,
      requestSampling: 50
    },
    appsec: {
      enabled: true,
      rules: "appsec-rules.json",
      standalone: {
        enabled: false
      }
    }
  },
  env: {
    DD_PROFILING_EXPERIMENTAL_CPU_ENABLED: "true",
    DD_TRACE_EXPERIMENTAL_RUNTIME_ID_ENABLED: "true",
    DD_TRACE_PROPAGATION_STYLE: "b3 single header"
  }
});

tracer.use("http", {
  whitelist: ["/health"],
  blacklist: [/admin/]
});

tracer.use("redis", {
  whitelist: ["cache"],
  blacklist: ["internal"]
});

const span = tracer.scope().active();
const otherSpan = tracer.scope().active();

span?.addLink(otherSpan!.context(), { feature: "checkout" });

process.env.DD_PROFILING_EXPERIMENTAL_TIMELINE_ENABLED = "true";
process.env["DD_PROFILING_EXPERIMENTAL_ENDPOINT_COLLECTION_ENABLED"] = "false";
process.env.DD_TRACE_EXPERIMENTAL_RUNTIME_ID_ENABLED = "true";
process.env.DD_TRACE_PROPAGATION_STYLE = "b3 single header";

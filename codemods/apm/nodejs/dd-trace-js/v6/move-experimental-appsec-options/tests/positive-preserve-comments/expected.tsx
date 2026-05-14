import tracer from "dd-trace";

tracer.init({
  experimental: {
    b3: true
  },
  // keep appsec rationale
  appsec: {
    // keep enabled rationale
    enabled: true
  },
  // keep standalone rationale
  apmTracingEnabled: false
});

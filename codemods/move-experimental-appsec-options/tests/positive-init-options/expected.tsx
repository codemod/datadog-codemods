import tracer from "dd-trace";

tracer.init({
  service: "api",
  experimental: {
    iast: { enabled: true }
  },
  appsec: {
    enabled: true,
    rules: "rules.json"
  },
  apmTracingEnabled: false
});

import tracer from "dd-trace";

security.init({
  experimental: {
    iast: {
      enabled: true
    }
  }
});

tracer.init({
  service: "api"
});

import tracer from "dd-trace";

security.init({
  experimental: {
    appsec: {
      enabled: true
    }
  }
});

tracer.init({
  service: "api"
});

import tracer from "dd-trace";

tracer.init({
  experimental: {
    // keep appsec rationale
    appsec: {
      // keep enabled rationale
      enabled: true,
      // keep standalone rationale
      standalone: {
        enabled: false
      }
    },
    b3: true
  }
});

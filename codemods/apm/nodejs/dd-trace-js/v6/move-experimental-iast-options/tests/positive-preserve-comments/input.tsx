import tracer from "dd-trace";

tracer.init({
  experimental: {
    // keep this marker
    iast: {
      enabled: true, // inline marker
      // keep nested marker
      redaction: "all"
    },
    b3: true
  }
});

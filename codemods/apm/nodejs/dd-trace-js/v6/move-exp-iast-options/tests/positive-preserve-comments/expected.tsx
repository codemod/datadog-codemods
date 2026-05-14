import tracer from "dd-trace";

tracer.init({
  experimental: {
    b3: true
  },
  // keep this marker
  iast: {
    enabled: true, // inline marker
    // keep nested marker
    redaction: "all"
  }
});

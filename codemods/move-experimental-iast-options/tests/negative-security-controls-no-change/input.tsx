import tracer from "dd-trace";

tracer.init({
  experimental: {
    iast: {
      enabled: true,
      securityControlsConfiguration: "redacted"
    }
  }
});

import tracer from "dd-trace";

tracer.init({
  experimental: {
    iast: {
      enabled: true,
      securityControlsConfiguration: "redacted-config"
    }
  }
});

tracer.init({
  appsec: {
    extendedHeadersCollection: {
      enabled: true,
      redaction: true,
      maxHeaders: 50
    },
    rasp: {
      bodyCollection: true
    }
  }
});

process.env.DD_TRACE_EXPERIMENTAL_B3_ENABLED = "true";

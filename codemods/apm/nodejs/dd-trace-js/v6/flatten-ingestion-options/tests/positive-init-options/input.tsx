import tracer from "dd-trace";

tracer.init({
  service: "api",
  ingestion: {
    sampleRate: 0.5,
    rateLimit: 100
  }
});

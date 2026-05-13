import tracer from "dd-trace";

tracer.init({
  ingestion: {
    // keep sample rate rationale
    sampleRate: 0.5,
    // keep rate limit rationale
    rateLimit: 100
  }
});

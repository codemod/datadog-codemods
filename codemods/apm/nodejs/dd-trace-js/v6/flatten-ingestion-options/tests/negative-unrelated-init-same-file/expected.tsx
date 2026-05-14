import tracer from "dd-trace";

analytics.init({
  ingestion: {
    sampleRate: 0.5,
    rateLimit: 100
  }
});

tracer.init({
  service: "api"
});

import tracer from "dd-trace";

tracer.init({
  service: "api",
  sampleRate: 0.5,
  rateLimit: 100
});

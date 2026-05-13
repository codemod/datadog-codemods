import tracer from "dd-trace";

tracer.init({
  sampleRate: 1,
  ingestion: {
    sampleRate: 0.5,
    rateLimit: 100
  }
});

const config = {
  ingestion: {
    sampleRate: 0.5
  }
};

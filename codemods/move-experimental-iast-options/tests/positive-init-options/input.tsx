import tracer from "dd-trace";

tracer.init({
  service: "api",
  experimental: {
    b3: true,
    iast: {
      enabled: true,
      requestSampling: 50
    }
  }
});

import tracer from "dd-trace";

tracer.init({
  experimental: {
    appsec: {
      enabled: true,
      extendedHeadersCollection: {
        enabled: true
      }
    }
  }
});

tracer.init({
  experimental: {
    appsec: {
      rasp: {
        bodyCollection: true
      }
    }
  }
});

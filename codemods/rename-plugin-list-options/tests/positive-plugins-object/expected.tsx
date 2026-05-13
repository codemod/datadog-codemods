import tracer from "dd-trace";

tracer.init({
  plugins: {
    http: {
      allowlist: ["/health"]
    },
    redis: {
      blocklist: ["internal"]
    },
    express: {
      whitelist: ["/ignored"]
    }
  }
});

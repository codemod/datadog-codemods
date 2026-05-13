import tracer from "dd-trace";

tracer.init({
  plugins: {
    http: {
      whitelist: ["/health"]
    },
    redis: {
      blacklist: ["internal"]
    },
    express: {
      whitelist: ["/ignored"]
    }
  }
});

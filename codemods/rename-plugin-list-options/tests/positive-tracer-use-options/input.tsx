import tracer from "dd-trace";

tracer.use("http", {
  whitelist: ["/health"],
  blacklist: [/admin/]
});

tracer.use("ioredis", { "whitelist": ["cache"] });
tracer.use("express", { whitelist: ["/ignored"] });

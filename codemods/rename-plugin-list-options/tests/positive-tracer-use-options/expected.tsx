import tracer from "dd-trace";

tracer.use("http", {
  allowlist: ["/health"],
  blocklist: [/admin/]
});

tracer.use("ioredis", { "allowlist": ["cache"] });
tracer.use("express", { whitelist: ["/ignored"] });

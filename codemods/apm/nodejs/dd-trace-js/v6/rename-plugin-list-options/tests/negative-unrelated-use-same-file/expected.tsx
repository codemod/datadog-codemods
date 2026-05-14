import tracer from "dd-trace";

plugins.use("http", {
  whitelist: ["/health"],
  blacklist: [/admin/]
});

tracer.use("express", {
  whitelist: ["/ignored"]
});

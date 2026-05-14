import * as ddTrace from "dd-trace";

ddTrace.use("http", {
  allowlist: ["/health"]
});

require("dd-trace").use("redis", {
  blocklist: ["internal"]
});

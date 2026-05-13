import * as ddTrace from "dd-trace";

ddTrace.use("http", {
  whitelist: ["/health"]
});

require("dd-trace").use("redis", {
  blacklist: ["internal"]
});

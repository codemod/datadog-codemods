import * as ddTrace from "dd-trace";

ddTrace.init({
  sampleRate: 0.25
});

require("dd-trace").init({
  rateLimit: 25
});

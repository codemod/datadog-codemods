import * as ddTrace from "dd-trace";

ddTrace.init({
  ingestion: {
    sampleRate: 0.25
  }
});

require("dd-trace").init({
  ingestion: {
    rateLimit: 25
  }
});

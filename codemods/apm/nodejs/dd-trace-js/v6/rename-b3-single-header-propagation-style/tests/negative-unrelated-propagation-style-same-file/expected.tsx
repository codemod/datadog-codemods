import tracer from "dd-trace";

const config = {
  propagationStyle: ["b3 single header"]
};

tracer.init({
  service: "api"
});

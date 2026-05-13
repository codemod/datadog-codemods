import tracer from "dd-trace";

function configure(tracer: { init(options: unknown): void }) {
  tracer.init({
    propagationStyle: "b3 single header"
  });
}

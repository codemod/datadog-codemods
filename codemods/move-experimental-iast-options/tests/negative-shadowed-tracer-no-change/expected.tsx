import tracer from "dd-trace";

function configure(tracer: { init(options: unknown): void }) {
  tracer.init({
    experimental: {
      iast: {
        enabled: true
      }
    }
  });
}

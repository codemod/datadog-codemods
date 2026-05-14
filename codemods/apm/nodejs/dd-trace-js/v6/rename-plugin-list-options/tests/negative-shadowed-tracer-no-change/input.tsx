import tracer from "dd-trace";

function configure(tracer: { use(name: string, options: unknown): void }) {
  tracer.use("http", {
    whitelist: ["/health"]
  });
}

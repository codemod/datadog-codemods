import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("recipe metadata names every local codemod step", () => {
  const workflow = readFileSync(new URL("../workflow.yaml", import.meta.url), "utf8");

  for (const slug of [
    "add-link-object-argument",
    "rename-plugin-list-options",
    "move-experimental-iast-options",
    "move-experimental-appsec-options",
    "flatten-ingestion-options",
    "rename-profiling-env-vars",
    "rename-runtime-id-env-var",
    "rename-b3-single-header-propagation-style",
  ]) {
    assert.match(workflow, new RegExp(`js_file: ../${slug}/scripts/codemod.ts`));
  }
});

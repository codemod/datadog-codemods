import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('recipe metadata names every local codemod step', () => {
  const workflow = readFileSync(new URL('../workflow.yaml', import.meta.url), 'utf8')

  for (const slug of [
    'dd-trace-5-to-6-add-link-object-argument',
    'dd-trace-5-to-6-rename-plugin-list-options',
    'dd-trace-5-to-6-move-experimental-iast-options',
    'dd-trace-5-to-6-move-experimental-appsec-options',
    'dd-trace-5-to-6-flatten-ingestion-options',
    'dd-trace-5-to-6-rename-profiling-env-vars',
    'dd-trace-5-to-6-rename-runtime-id-env-var',
    'dd-trace-5-to-6-rename-b3-style',
  ]) {
    assert.match(workflow, new RegExp(`source: "${slug}"`))
  }
})

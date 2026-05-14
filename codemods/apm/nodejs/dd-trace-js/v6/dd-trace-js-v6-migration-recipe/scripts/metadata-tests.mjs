import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const STEP_SOURCES = [
  '@codemod/dd-trace-js-v6-add-link-object-argument',
  '@codemod/dd-trace-js-v6-rename-plugin-list-options',
  '@codemod/dd-trace-js-v6-move-experimental-iast-options',
  '@codemod/dd-trace-js-v6-move-experimental-appsec-options',
  '@codemod/dd-trace-js-v6-flatten-ingestion-options',
  '@codemod/dd-trace-js-v6-rename-profiling-env-vars',
  '@codemod/dd-trace-js-v6-rename-runtime-id-env-var',
  '@codemod/dd-trace-js-v6-rename-b3-style',
]

test('recipe metadata names every local codemod step', () => {
  const workflow = readFileSync(new URL('../workflow.yaml', import.meta.url), 'utf8')

  for (const slug of STEP_SOURCES) {
    const escaped = slug.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(workflow, new RegExp(`source: ['"]${escaped}['"]`))
  }
})

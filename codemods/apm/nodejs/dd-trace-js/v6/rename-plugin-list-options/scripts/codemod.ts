import { getImport } from '@jssg/utils/javascript/imports'
import type { Edit, SgNode, Transform } from 'codemod:ast-grep'
import type TSX from 'codemod:ast-grep/langs/tsx'
import { useMetricAtom } from 'codemod:metrics'

const DD_TRACE_MODULE = 'dd-trace'
const TARGET_PLUGINS = new Set(['http', 'ioredis', 'iovalkey', 'redis'])
const RENAMES = new Map([
  ['whitelist', 'allowlist'],
  ['blacklist', 'blocklist'],
])

function metricFile(filename: string): string {
  const cwd = `${process.cwd()}/`
  return filename.startsWith(cwd) ? filename.slice(cwd.length) : filename
}

function stripQuotes(text: string): string {
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1)
  }
  return text
}

function keyName(pair: SgNode<TSX>): string | null {
  const key = pair.field('key')
  return key ? stripQuotes(key.text()) : null
}

function keyReplacement(key: SgNode<TSX>, nextName: string): string {
  const text = key.text()
  if (text.startsWith('"')) {
    return `"${nextName}"`
  }
  if (text.startsWith("'")) {
    return `'${nextName}'`
  }
  return nextName
}

function namedChildren(node: SgNode<TSX>): SgNode<TSX>[] {
  return node.children().filter((child) => child.isNamed())
}

function callArguments(call: SgNode<TSX>): SgNode<TSX>[] {
  const args = call.field('arguments') ?? call.find({ rule: { kind: 'arguments' } })
  return args ? namedChildren(args) : []
}

function literalText(node: SgNode<TSX> | undefined): string | null {
  if (!node) {
    return null
  }
  if (node.kind() !== 'string') {
    return null
  }
  const fragment = node.find({ rule: { kind: 'string_fragment' } })
  return fragment ? fragment.text() : stripQuotes(node.text())
}

function isRequireDdTraceCall(call: SgNode<TSX>): boolean {
  if (call.field('function')?.text() !== 'require') {
    return false
  }
  return literalText(callArguments(call)[0]) === DD_TRACE_MODULE
}

function findDdTraceBindings(rootNode: SgNode<TSX, 'program'>): Set<string> {
  const bindings = new Set<string>()
  const defaultBinding = getImport(rootNode, { type: 'default', from: DD_TRACE_MODULE })
  if (defaultBinding) {
    bindings.add(defaultBinding.alias)
  }
  const namedTracerBinding = getImport(rootNode, { type: 'named', name: 'tracer', from: DD_TRACE_MODULE })
  if (namedTracerBinding) {
    bindings.add(namedTracerBinding.alias)
  }

  for (const importNode of rootNode.findAll({ rule: { kind: 'import_statement' } })) {
    const source = importNode.field('source') ?? importNode.find({ rule: { kind: 'string' } })
    if (literalText(source ?? undefined) !== DD_TRACE_MODULE) {
      continue
    }

    const namespaceImport = importNode.find({ rule: { kind: 'namespace_import' } })
    const namespaceName = namespaceImport?.field('name') ?? namespaceImport?.find({ rule: { kind: 'identifier' } })
    if (namespaceName) {
      bindings.add(namespaceName.text())
    }
  }

  return bindings
}

function closestAncestor(node: SgNode<TSX>, kind: string): SgNode<TSX> | null {
  if (node.kind() === kind) {
    return node
  }
  return node.ancestors().find((ancestor) => ancestor.kind() === kind) ?? null
}

function definitionComesFromDdTrace(node: SgNode<TSX>): boolean {
  const importStatement = closestAncestor(node, 'import_statement')
  if (importStatement) {
    const source = importStatement.field('source') ?? importStatement.find({ rule: { kind: 'string' } })
    return literalText(source ?? undefined) === DD_TRACE_MODULE
  }

  const declarator = closestAncestor(node, 'variable_declarator')
  const value = declarator?.field('value')
  return Boolean(value?.kind() === 'call_expression' && isRequireDdTraceCall(value))
}

function isDdTraceBindingReference(node: SgNode<TSX>, bindings: Set<string>): boolean {
  if (node.kind() !== 'identifier' || !bindings.has(node.text())) {
    return false
  }
  const definition = node.definition()
  return Boolean(definition?.node && definitionComesFromDdTrace(definition.node))
}

function isDdTraceObject(node: SgNode<TSX> | null | undefined, bindings: Set<string>): boolean {
  if (!node) {
    return false
  }
  if (node.kind() === 'identifier') {
    return isDdTraceBindingReference(node, bindings)
  }
  return node.kind() === 'call_expression' && isRequireDdTraceCall(node)
}

function isDdTraceMethodCall(call: SgNode<TSX>, method: string, bindings: Set<string>): boolean {
  const fn = call.field('function')
  if (fn?.kind() !== 'member_expression') {
    return false
  }

  const property = fn.field('property') ?? fn.find({ rule: { kind: 'property_identifier' } })
  if (property?.text() !== method) {
    return false
  }

  return isDdTraceObject(fn.field('object'), bindings)
}

function isTargetPluginUseOptions(objectNode: SgNode<TSX>, bindings: Set<string>): boolean {
  for (const call of objectNode.ancestors().filter((node) => node.kind() === 'call_expression')) {
    const args = callArguments(call)
    if (args.length < 2 || args[1]?.id() !== objectNode.id()) {
      continue
    }
    if (!isDdTraceMethodCall(call, 'use', bindings)) {
      continue
    }

    const pluginName = literalText(args[0])
    if (pluginName && TARGET_PLUGINS.has(pluginName)) {
      return true
    }
  }
  return false
}

function valueObjectPair(objectNode: SgNode<TSX>): SgNode<TSX> | null {
  const parent = objectNode.parent()
  if (parent?.kind() === 'pair' && parent.field('value')?.id() === objectNode.id()) {
    return parent
  }
  return null
}

function isDdTraceInitOptionsObject(objectNode: SgNode<TSX>, bindings: Set<string>): boolean {
  for (const call of objectNode.ancestors().filter((node) => node.kind() === 'call_expression')) {
    const args = callArguments(call)
    if (args[0]?.id() !== objectNode.id()) {
      continue
    }
    if (isDdTraceMethodCall(call, 'init', bindings)) {
      return true
    }
  }
  return false
}

function isTargetPluginConfigObject(objectNode: SgNode<TSX>, bindings: Set<string>): boolean {
  const pluginPair = valueObjectPair(objectNode)
  if (!pluginPair) {
    return false
  }

  const pluginName = keyName(pluginPair)
  if (!pluginName || !TARGET_PLUGINS.has(pluginName)) {
    return false
  }

  const pluginsObject = pluginPair.parent()
  const pluginsPair = pluginsObject ? valueObjectPair(pluginsObject) : null
  const optionsObject = pluginsPair?.parent()
  return (
    keyName(pluginsPair ?? pluginPair) === 'plugins' &&
    Boolean(optionsObject?.kind() === 'object' && isDdTraceInitOptionsObject(optionsObject, bindings))
  )
}

function isEligiblePluginOptionsObject(objectNode: SgNode<TSX>, bindings: Set<string>): boolean {
  return isTargetPluginUseOptions(objectNode, bindings) || isTargetPluginConfigObject(objectNode, bindings)
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root()
  const ddTraceBindings = findDdTraceBindings(rootNode)

  const edits: Edit[] = []
  const metric = useMetricAtom('rename-plugin-list-options')

  const pairs = rootNode.findAll({ rule: { kind: 'pair' } })
  for (const pair of pairs) {
    const currentName = keyName(pair)
    if (!currentName) {
      continue
    }

    const nextName = RENAMES.get(currentName)
    if (!nextName) {
      continue
    }

    const parentObject = pair.parent()
    if (parentObject?.kind() !== 'object') {
      continue
    }
    if (!isEligiblePluginOptionsObject(parentObject, ddTraceBindings)) {
      metric.increment({ file: metricFile(root.filename()), option: currentName, result: 'skipped-context' })
      continue
    }

    const key = pair.field('key')
    if (!key) {
      continue
    }

    edits.push(key.replace(keyReplacement(key, nextName)))
    metric.increment({ file: metricFile(root.filename()), option: currentName, result: 'renamed' })
  }

  if (edits.length === 0) {
    return null
  }
  return rootNode.commitEdits(edits)
}

export default transform

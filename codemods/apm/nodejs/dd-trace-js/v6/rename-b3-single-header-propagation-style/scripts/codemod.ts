import { getImport } from '@jssg/utils/javascript/imports'
import type { Edit, SgNode, Transform } from 'codemod:ast-grep'
import type TSX from 'codemod:ast-grep/langs/tsx'
import { useMetricAtom } from 'codemod:metrics'

const DD_TRACE_MODULE = 'dd-trace'
const OLD_VALUE = 'b3 single header'
const NEW_VALUE = 'b3'

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

function quotedReplacement(original: string): string {
  if (original.startsWith("'")) {
    return `'${NEW_VALUE}'`
  }
  return `"${NEW_VALUE}"`
}

function keyName(pair: SgNode<TSX>): string | null {
  const key = pair.field('key')
  return key ? stripQuotes(key.text()) : null
}

function stringLiteralValue(node: SgNode<TSX> | null | undefined): string | null {
  if (node?.kind() !== 'string') {
    return null
  }
  const fragment = node.find({ rule: { kind: 'string_fragment' } })
  return fragment ? fragment.text() : stripQuotes(node.text())
}

function namedChildren(node: SgNode<TSX>): SgNode<TSX>[] {
  return node.children().filter((child) => child.isNamed())
}

function callArguments(call: SgNode<TSX>): SgNode<TSX>[] {
  const args = call.field('arguments') ?? call.find({ rule: { kind: 'arguments' } })
  return args ? namedChildren(args) : []
}

function isRequireDdTraceCall(call: SgNode<TSX>): boolean {
  if (call.field('function')?.text() !== 'require') {
    return false
  }
  return stringLiteralValue(callArguments(call)[0]) === DD_TRACE_MODULE
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
    if (stringLiteralValue(source) !== DD_TRACE_MODULE) {
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
    return stringLiteralValue(source) === DD_TRACE_MODULE
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

function isDdTraceInitOptionsObject(objectNode: SgNode<TSX>, bindings: Set<string>): boolean {
  for (const call of objectNode.ancestors().filter((node) => node.kind() === 'call_expression')) {
    const args = callArguments(call)
    if (args[0]?.id() !== objectNode.id()) {
      continue
    }

    const fn = call.field('function')
    const property = fn?.field('property') ?? fn?.find({ rule: { kind: 'property_identifier' } })
    if (property?.text() !== 'init') {
      continue
    }

    if (isDdTraceObject(fn?.field('object'), bindings)) {
      return true
    }
  }
  return false
}

function isInsideValueOfPair(node: SgNode<TSX>, pair: SgNode<TSX>): boolean {
  const value = pair.field('value')
  if (!value) {
    return false
  }
  if (value.id() === node.id()) {
    return true
  }
  return node.ancestors().some((ancestor) => ancestor.id() === value.id())
}

function isDatadogPropagationStyleValue(node: SgNode<TSX>, bindings: Set<string>): boolean {
  for (const pair of node.ancestors().filter((ancestor) => ancestor.kind() === 'pair')) {
    if (keyName(pair) !== 'propagationStyle' || !isInsideValueOfPair(node, pair)) {
      continue
    }

    const optionsObject = pair.parent()
    return Boolean(optionsObject?.kind() === 'object' && isDdTraceInitOptionsObject(optionsObject, bindings))
  }

  return false
}

function isDatadogEnvConfigValue(node: SgNode<TSX>): boolean {
  for (const pair of node.ancestors().filter((ancestor) => ancestor.kind() === 'pair')) {
    if (keyName(pair) === 'DD_TRACE_PROPAGATION_STYLE' && isInsideValueOfPair(node, pair)) {
      return true
    }
  }

  return false
}

function isProcessEnvObject(node: SgNode<TSX> | null | undefined): boolean {
  if (node?.kind() !== 'member_expression') {
    return false
  }
  const object = node.field('object')
  const property = node.field('property') ?? node.find({ rule: { kind: 'property_identifier' } })
  return object?.text() === 'process' && property?.text() === 'env'
}

function isProcessEnvPropagationTarget(left: SgNode<TSX> | null | undefined): boolean {
  if (!left) {
    return false
  }
  if (left.kind() === 'member_expression') {
    const object = left.field('object')
    const property = left.field('property') ?? left.find({ rule: { kind: 'property_identifier' } })
    return isProcessEnvObject(object) && property?.text() === 'DD_TRACE_PROPAGATION_STYLE'
  }

  if (left.kind() === 'subscript_expression') {
    const object = left.field('object')
    const index = left.field('index') ?? left.find({ rule: { kind: 'string' } })
    return isProcessEnvObject(object) && stringLiteralValue(index) === 'DD_TRACE_PROPAGATION_STYLE'
  }

  return false
}

function isProcessEnvPropagationAssignmentValue(node: SgNode<TSX>): boolean {
  for (const assignment of node.ancestors().filter((ancestor) => ancestor.kind() === 'assignment_expression')) {
    const right = assignment.field('right')
    if (right?.id() !== node.id()) {
      continue
    }
    if (isProcessEnvPropagationTarget(assignment.field('left'))) {
      return true
    }
  }
  return false
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root()
  const ddTraceBindings = findDdTraceBindings(rootNode)
  const edits: Edit[] = []
  const metric = useMetricAtom('rename-b3-single-header-propagation-style')

  for (const str of rootNode.findAll({ rule: { kind: 'string' } })) {
    if (stripQuotes(str.text()) !== OLD_VALUE) {
      continue
    }

    if (
      !isDatadogEnvConfigValue(str) &&
      !isDatadogPropagationStyleValue(str, ddTraceBindings) &&
      !isProcessEnvPropagationAssignmentValue(str)
    ) {
      metric.increment({ file: metricFile(root.filename()), result: 'skipped-context' })
      continue
    }

    edits.push(str.replace(quotedReplacement(str.text())))
    metric.increment({ file: metricFile(root.filename()), result: 'renamed' })
  }

  if (edits.length === 0) {
    return null
  }
  return rootNode.commitEdits(edits)
}

export default transform

import { getImport } from '@jssg/utils/javascript/imports'
import type { Edit, SgNode, Transform } from 'codemod:ast-grep'
import type TSX from 'codemod:ast-grep/langs/tsx'
import { useMetricAtom } from 'codemod:metrics'

const DD_TRACE_MODULE = 'dd-trace'

type SpanBindings = Map<string, Set<number>>

function metricFile(filename: string): string {
  const cwd = `${process.cwd()}/`
  return filename.startsWith(cwd) ? filename.slice(cwd.length) : filename
}

function namedChildren(node: SgNode<TSX>): SgNode<TSX>[] {
  return node.children().filter((child) => child.isNamed())
}

function stripQuotes(text: string): string {
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1)
  }
  return text
}

function stringLiteralValue(node: SgNode<TSX> | null | undefined): string | null {
  if (node?.kind() !== 'string') {
    return null
  }
  const fragment = node.find({ rule: { kind: 'string_fragment' } })
  return fragment ? fragment.text() : stripQuotes(node.text())
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

function findDdTraceSpanTypeNames(rootNode: SgNode<TSX, 'program'>): Set<string> {
  const names = new Set<string>()
  const spanImport = getImport(rootNode, { type: 'named', name: 'Span', from: DD_TRACE_MODULE })
  if (spanImport) {
    names.add(spanImport.alias)
  }

  for (const importNode of rootNode.findAll({ rule: { kind: 'import_statement' } })) {
    const source = importNode.field('source') ?? importNode.find({ rule: { kind: 'string' } })
    if (stringLiteralValue(source) !== DD_TRACE_MODULE) {
      continue
    }

    for (const specifier of importNode.findAll({ rule: { kind: 'import_specifier' } })) {
      const identifiers = specifier
        .children()
        .filter((child) => child.isNamed() && (child.kind() === 'identifier' || child.kind() === 'type_identifier'))
      if (identifiers[0]?.text() !== 'Span') {
        continue
      }
      names.add(identifiers.at(-1)?.text() ?? 'Span')
    }
  }
  return names
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

function isMemberCall(node: SgNode<TSX> | null | undefined, method: string): boolean {
  if (node?.kind() !== 'call_expression') {
    return false
  }
  const fn = node.field('function')
  const property = fn?.field('property') ?? fn?.find({ rule: { kind: 'property_identifier' } })
  return fn?.kind() === 'member_expression' && property?.text() === method
}

function isDdTraceMemberCall(node: SgNode<TSX> | null | undefined, method: string, bindings: Set<string>): boolean {
  if (!isMemberCall(node, method)) {
    return false
  }
  if (!node) {
    return false
  }
  const fn = node.field('function')
  return isDdTraceObject(fn?.field('object'), bindings)
}

function isDdTraceSpanFactory(node: SgNode<TSX> | null | undefined, bindings: Set<string>): boolean {
  if (node?.kind() !== 'call_expression') {
    return false
  }
  if (isDdTraceMemberCall(node, 'startSpan', bindings)) {
    return true
  }

  if (!isMemberCall(node, 'active')) {
    return false
  }
  const fn = node.field('function')
  const scopeCall = fn?.field('object')
  return isDdTraceMemberCall(scopeCall, 'scope', bindings)
}

function addSpanBinding(bindings: SpanBindings, name: SgNode<TSX>): void {
  const current = bindings.get(name.text()) ?? new Set<number>()
  current.add(name.id())
  const parent = name.parent()
  if (parent) {
    current.add(parent.id())
  }
  bindings.set(name.text(), current)
}

function isSpanBindingReference(node: SgNode<TSX>, bindings: SpanBindings): boolean {
  if (node.kind() !== 'identifier') {
    return false
  }
  const definitions = bindings.get(node.text())
  if (!definitions) {
    return false
  }

  const definition = node.definition()
  return Boolean(definition?.node && definitions.has(definition.node.id()))
}

function isDdTraceSpanTypeReference(typeName: SgNode<TSX>, spanTypeNames: Set<string>): boolean {
  if (!spanTypeNames.has(typeName.text())) {
    return false
  }
  const definition = typeName.definition()
  return Boolean(definition?.node && definitionComesFromDdTrace(definition.node))
}

function findDdTraceSpanVariables(rootNode: SgNode<TSX, 'program'>, bindings: Set<string>): SpanBindings {
  const variables: SpanBindings = new Map()

  for (const declarator of rootNode.findAll({ rule: { kind: 'variable_declarator' } })) {
    const name = declarator.field('name')
    const value = declarator.field('value')
    if (name?.kind() === 'identifier' && isDdTraceSpanFactory(value, bindings)) {
      addSpanBinding(variables, name)
    }
  }

  const spanTypeNames = findDdTraceSpanTypeNames(rootNode)
  if (spanTypeNames.size > 0) {
    for (const parameter of rootNode.findAll({ rule: { kind: 'required_parameter' } })) {
      const name = parameter.children().find((child) => child.kind() === 'identifier')
      const typeName = parameter.find({ rule: { kind: 'type_identifier' } })
      if (name && typeName && isDdTraceSpanTypeReference(typeName, spanTypeNames)) {
        addSpanBinding(variables, name)
      }
    }
  }

  return variables
}

function isAddLinkCall(call: SgNode<TSX>): boolean {
  const fn = call.field('function')
  if (fn?.kind() !== 'member_expression') {
    return false
  }

  const property = fn.field('property') ?? fn.find({ rule: { kind: 'property_identifier' } })
  return property?.text() === 'addLink'
}

function isEligibleAddLinkReceiver(call: SgNode<TSX>, spanVariables: SpanBindings, bindings: Set<string>): boolean {
  const fn = call.field('function')
  const receiver = fn?.field('object')
  if (!receiver) {
    return false
  }
  if (receiver.kind() === 'identifier') {
    return isSpanBindingReference(receiver, spanVariables)
  }
  return isDdTraceSpanFactory(receiver, bindings)
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root()
  const ddTraceBindings = findDdTraceBindings(rootNode)
  const ddTraceSpanVariables = findDdTraceSpanVariables(rootNode, ddTraceBindings)

  const edits: Edit[] = []
  const metric = useMetricAtom('add-link-object-argument')

  const calls = rootNode.findAll({ rule: { kind: 'call_expression' } })
  for (const call of calls) {
    if (!isAddLinkCall(call)) {
      continue
    }

    const args = callArguments(call)
    if (!isEligibleAddLinkReceiver(call, ddTraceSpanVariables, ddTraceBindings)) {
      if (args.length === 2) {
        metric.increment({ file: metricFile(root.filename()), result: 'skipped-context' })
      }
      continue
    }

    if (args.length !== 2) {
      if (args.length > 2) {
        metric.increment({ file: metricFile(root.filename()), result: 'skipped-arity' })
      }
      continue
    }

    const [contextArg, attributesArg] = args
    if (!contextArg || !attributesArg) {
      continue
    }

    edits.push({
      startPos: contextArg.range().start.index,
      endPos: attributesArg.range().end.index,
      insertedText: `{ context: ${contextArg.text()}, attributes: ${attributesArg.text()} }`,
    })
    metric.increment({ file: metricFile(root.filename()), result: 'rewritten' })
  }

  if (edits.length === 0) {
    return null
  }
  return rootNode.commitEdits(edits)
}

export default transform

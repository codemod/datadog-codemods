import { getImport } from '@jssg/utils/javascript/imports'
import type { Edit, SgNode, Transform } from 'codemod:ast-grep'
import type TSX from 'codemod:ast-grep/langs/tsx'
import { useMetricAtom } from 'codemod:metrics'

const DD_TRACE_MODULE = 'dd-trace'

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

function objectPairs(objectNode: SgNode<TSX>): SgNode<TSX>[] {
  return namedChildren(objectNode).filter((child) => child.kind() === 'pair')
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

function valueObjectPair(objectNode: SgNode<TSX>): SgNode<TSX> | null {
  const parent = objectNode.parent()
  if (parent?.kind() === 'pair' && parent.field('value')?.id() === objectNode.id()) {
    return parent
  }
  return null
}

function lineIndent(source: string, index: number): string {
  const lineStart = source.lastIndexOf('\n', index - 1) + 1
  const linePrefix = source.slice(lineStart, index)
  const match = /^[ \t]*/.exec(linePrefix)
  return match ? match[0] : ''
}

function lineIndentFromStart(source: string, lineStart: number): string {
  const match = /^[ \t]*/.exec(source.slice(lineStart))
  return match ? match[0] : ''
}

function isWhitespace(char: string | undefined): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r'
}

function leadingCommentStart(node: SgNode<TSX>, source: string): number {
  let cursor = node.range().start.index
  let sawComment = false

  while (cursor > 0) {
    const lineStart = source.lastIndexOf('\n', cursor - 1) + 1
    if (lineStart === 0) {
      break
    }

    const previousLineEnd = lineStart - 1
    const previousLineStart = source.lastIndexOf('\n', previousLineEnd - 1) + 1
    const previousLine = source.slice(previousLineStart, previousLineEnd)
    const trimmed = previousLine.trim()

    if (trimmed === '' && sawComment) {
      cursor = previousLineStart
      continue
    }

    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.endsWith('*/')) {
      cursor = previousLineStart
      sawComment = true
      continue
    }

    break
  }

  return cursor
}

function removalRangeWithComma(start: number, end: number, source: string): { start: number; end: number } {
  let removalStart = start
  let removalEnd = end

  let i = removalEnd
  while (isWhitespace(source[i])) {
    i++
  }
  if (source[i] === ',') {
    removalEnd = i + 1
  } else {
    let j = removalStart - 1
    while (isWhitespace(source[j])) {
      j--
    }
    if (source[j] === ',') {
      removalStart = j
    }
  }

  return { start: removalStart, end: removalEnd }
}

function hasNestedKey(objectNode: SgNode<TSX>, name: string): boolean {
  return objectNode.findAll({ rule: { kind: 'pair' } }).some((pair) => keyName(pair) === name)
}

function reindentText(text: string, fromIndent: string, toIndent: string, includeFirstIndent: boolean): string {
  return text
    .split('\n')
    .map((line, index) => {
      if (line.length === 0) {
        return line
      }
      const nextIndent = index === 0 && !includeFirstIndent ? '' : toIndent
      if (line.startsWith(fromIndent)) {
        return nextIndent + line.slice(fromIndent.length)
      }
      return nextIndent + line.trimStart()
    })
    .join('\n')
}

function pairTextWithLeadingComments(
  pair: SgNode<TSX>,
  source: string,
  toIndent: string,
  includeFirstIndent: boolean,
): string {
  const start = leadingCommentStart(pair, source)
  const fromIndent =
    start === pair.range().start.index
      ? lineIndent(source, pair.range().start.index)
      : lineIndentFromStart(source, start)
  const text = source.slice(start, pair.range().end.index)
  return reindentText(text, fromIndent, toIndent, includeFirstIndent)
}

function objectTextWithoutPair(objectNode: SgNode<TSX>, pair: SgNode<TSX>, source: string): string {
  const start = leadingCommentStart(pair, source)
  const range = removalRangeWithComma(start, pair.range().end.index, source)
  const before = source.slice(objectNode.range().start.index, range.start)
  const after = source.slice(range.end, objectNode.range().end.index)
  return before.endsWith('\n') && after.startsWith('\n') ? before + after.slice(1) : before + after
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root()
  const ddTraceBindings = findDdTraceBindings(rootNode)

  const source = rootNode.text()
  const edits: Edit[] = []
  const metric = useMetricAtom('move-experimental-iast-options')

  for (const iastPair of rootNode.findAll({ rule: { kind: 'pair' } })) {
    if (keyName(iastPair) !== 'iast') {
      continue
    }

    const experimentalObject = iastPair.parent()
    const experimentalPair = experimentalObject ? valueObjectPair(experimentalObject) : null
    if (experimentalObject?.kind() !== 'object' || keyName(experimentalPair ?? iastPair) !== 'experimental') {
      continue
    }

    const optionsObject = experimentalPair?.parent()
    if (
      !experimentalPair ||
      optionsObject?.kind() !== 'object' ||
      !isDdTraceInitOptionsObject(optionsObject, ddTraceBindings)
    ) {
      metric.increment({ file: metricFile(root.filename()), result: 'skipped-context' })
      continue
    }

    if (objectPairs(optionsObject).some((pair) => keyName(pair) === 'iast')) {
      metric.increment({ file: metricFile(root.filename()), result: 'skipped-conflict' })
      continue
    }

    const iastObject = iastPair.field('value')
    if (iastObject?.kind() !== 'object') {
      metric.increment({ file: metricFile(root.filename()), result: 'skipped-non-object' })
      continue
    }

    if (hasNestedKey(iastObject, 'securityControlsConfiguration')) {
      metric.increment({ file: metricFile(root.filename()), result: 'skipped-security-controls' })
      continue
    }

    const experimentalPairs = objectPairs(experimentalObject)
    const indent = lineIndent(source, experimentalPair.range().start.index)

    if (experimentalPairs.length === 1) {
      edits.push(experimentalPair.replace(pairTextWithLeadingComments(iastPair, source, indent, false)))
    } else {
      const experimentalText = objectTextWithoutPair(experimentalObject, iastPair, source)
      const iastText = pairTextWithLeadingComments(iastPair, source, indent, true)
      edits.push(experimentalPair.replace(`experimental: ${experimentalText},\n${iastText}`))
    }
    metric.increment({ file: metricFile(root.filename()), result: 'moved' })
  }

  if (edits.length === 0) {
    return null
  }
  return rootNode.commitEdits(edits)
}

export default transform

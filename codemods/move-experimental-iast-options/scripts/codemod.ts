import type { Edit, SgNode, Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import { useMetricAtom } from "codemod:metrics";
import { getImport } from "@jssg/utils/javascript/imports";

const DD_TRACE_MODULE = "dd-trace";

function metricFile(filename: string): string {
  const cwd = process.cwd() + "/";
  return filename.startsWith(cwd) ? filename.slice(cwd.length) : filename;
}

function stripQuotes(text: string): string {
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function keyName(pair: SgNode<TSX>): string | null {
  const key = pair.field("key");
  return key ? stripQuotes(key.text()) : null;
}

function stringLiteralValue(node: SgNode<TSX> | null | undefined): string | null {
  if (!node || node.kind() !== "string") return null;
  const fragment = node.find({ rule: { kind: "string_fragment" } });
  return fragment ? fragment.text() : stripQuotes(node.text());
}

function namedChildren(node: SgNode<TSX>): SgNode<TSX>[] {
  return node.children().filter((child) => child.isNamed());
}

function callArguments(call: SgNode<TSX>): SgNode<TSX>[] {
  const args = call.field("arguments") ?? call.find({ rule: { kind: "arguments" } });
  return args ? namedChildren(args) : [];
}

function objectPairs(objectNode: SgNode<TSX>): SgNode<TSX>[] {
  return namedChildren(objectNode).filter((child) => child.kind() === "pair");
}

function isRequireDdTraceCall(call: SgNode<TSX>): boolean {
  if (call.field("function")?.text() !== "require") return false;
  return stringLiteralValue(callArguments(call)[0]) === DD_TRACE_MODULE;
}

function findDdTraceBindings(rootNode: SgNode<TSX, "program">): Set<string> {
  const bindings = new Set<string>();
  const defaultBinding = getImport(rootNode, { type: "default", from: DD_TRACE_MODULE });
  if (defaultBinding) bindings.add(defaultBinding.alias);

  for (const importNode of rootNode.findAll({ rule: { kind: "import_statement" } })) {
    const source = importNode.field("source") ?? importNode.find({ rule: { kind: "string" } });
    if (stringLiteralValue(source) !== DD_TRACE_MODULE) continue;

    const namespaceImport = importNode.find({ rule: { kind: "namespace_import" } });
    const namespaceName = namespaceImport?.field("name") ?? namespaceImport?.find({ rule: { kind: "identifier" } });
    if (namespaceName) bindings.add(namespaceName.text());
  }

  return bindings;
}

function isDdTraceObject(node: SgNode<TSX> | null | undefined, bindings: Set<string>): boolean {
  if (!node) return false;
  if (node.kind() === "identifier") return bindings.has(node.text());
  return node.kind() === "call_expression" && isRequireDdTraceCall(node);
}

function isDdTraceInitOptionsObject(objectNode: SgNode<TSX>, bindings: Set<string>): boolean {
  for (const call of objectNode.ancestors().filter((node) => node.kind() === "call_expression")) {
    const args = callArguments(call);
    if (args[0]?.id() !== objectNode.id()) continue;

    const fn = call.field("function");
    const property = fn?.field("property") ?? fn?.find({ rule: { kind: "property_identifier" } });
    if (property?.text() !== "init") continue;

    if (isDdTraceObject(fn?.field("object"), bindings)) return true;
  }
  return false;
}

function valueObjectPair(objectNode: SgNode<TSX>): SgNode<TSX> | null {
  const parent = objectNode.parent();
  if (parent?.kind() === "pair" && parent.field("value")?.id() === objectNode.id()) return parent;
  return null;
}

function lineIndent(source: string, index: number): string {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  const linePrefix = source.slice(lineStart, index);
  const match = /^[ \t]*/.exec(linePrefix);
  return match ? match[0] : "";
}

function isWhitespace(char: string | undefined): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function removeNodeWithComma(node: SgNode<TSX>, source: string): Edit {
  let start = node.range().start.index;
  let end = node.range().end.index;

  let i = end;
  while (isWhitespace(source[i])) i++;
  if (source[i] === ",") {
    end = i + 1;
    while (isWhitespace(source[end])) end++;
  } else {
    let j = start - 1;
    while (isWhitespace(source[j])) j--;
    if (source[j] === ",") start = j;
  }

  return { startPos: start, endPos: end, insertedText: "" };
}

function hasNestedKey(objectNode: SgNode<TSX>, name: string): boolean {
  return objectNode.findAll({ rule: { kind: "pair" } }).some((pair) => keyName(pair) === name);
}

function pairText(pair: SgNode<TSX>): string | null {
  const key = pair.field("key");
  const value = pair.field("value");
  if (!key || !value) return null;
  return `${key.text()}: ${value.text()}`;
}

function objectLiteralText(objectNode: SgNode<TSX>, baseIndent: string): string | null {
  const pairs = objectPairs(objectNode).map(pairText);
  if (pairs.some((text) => text === null)) return null;
  if (pairs.length === 0) return "{}";

  const childIndent = `${baseIndent}  `;
  return `{\n${(pairs as string[]).map((text) => `${childIndent}${text}`).join(",\n")}\n${baseIndent}}`;
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root();
  const ddTraceBindings = findDdTraceBindings(rootNode);

  const source = rootNode.text();
  const edits: Edit[] = [];
  const metric = useMetricAtom("move-experimental-iast-options");

  for (const iastPair of rootNode.findAll({ rule: { kind: "pair" } })) {
    if (keyName(iastPair) !== "iast") continue;

    const experimentalObject = iastPair.parent();
    const experimentalPair = experimentalObject ? valueObjectPair(experimentalObject) : null;
    if (!experimentalObject || experimentalObject.kind() !== "object" || keyName(experimentalPair ?? iastPair) !== "experimental") {
      continue;
    }

    const optionsObject = experimentalPair?.parent();
    if (!experimentalPair || !optionsObject || optionsObject.kind() !== "object" || !isDdTraceInitOptionsObject(optionsObject, ddTraceBindings)) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-context" });
      continue;
    }

    if (objectPairs(optionsObject).some((pair) => keyName(pair) === "iast")) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-conflict" });
      continue;
    }

    const iastObject = iastPair.field("value");
    if (!iastObject || iastObject.kind() !== "object") {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-non-object" });
      continue;
    }

    if (hasNestedKey(iastObject, "securityControlsConfiguration")) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-security-controls" });
      continue;
    }

    const experimentalPairs = objectPairs(experimentalObject);
    const iastText = objectLiteralText(iastObject, lineIndent(source, experimentalPair.range().start.index));
    if (!iastText) continue;

    if (experimentalPairs.length === 1) {
      edits.push(experimentalPair.replace(`iast: ${iastText}`));
    } else {
      const indent = lineIndent(source, experimentalPair.range().start.index);
      const remainingPairs = experimentalPairs.filter((pair) => pair.id() !== iastPair.id()).map(pairText);
      if (remainingPairs.some((text) => text === null)) continue;

      const childIndent = `${indent}  `;
      const experimentalText = `experimental: {\n${(remainingPairs as string[]).map((text) => `${childIndent}${text}`).join(",\n")}\n${indent}}`;
      edits.push(experimentalPair.replace(`${experimentalText},\n${indent}iast: ${iastText}`));
    }
    metric.increment({ file: metricFile(root.filename()), result: "moved" });
  }

  if (edits.length === 0) return null;
  return rootNode.commitEdits(edits);
};

export default transform;

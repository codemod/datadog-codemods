import type { Edit, SgNode, Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import { useMetricAtom } from "codemod:metrics";
import { getImport } from "@jssg/utils/javascript/imports";

const DD_TRACE_MODULE = "dd-trace";
const INGESTION_KEYS = new Set(["sampleRate", "rateLimit"]);

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

    const calleeObject = fn?.field("object");
    if (isDdTraceObject(calleeObject, bindings)) return true;
  }
  return false;
}

function objectPairs(objectNode: SgNode<TSX>): SgNode<TSX>[] {
  return namedChildren(objectNode).filter((child) => child.kind() === "pair");
}

function lineIndent(source: string, index: number): string {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  const linePrefix = source.slice(lineStart, index);
  const match = /^[ \t]*/.exec(linePrefix);
  return match ? match[0] : "";
}

function pairText(pair: SgNode<TSX>): string | null {
  const key = pair.field("key");
  const value = pair.field("value");
  if (!key || !value) return null;
  return `${key.text()}: ${value.text()}`;
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root();
  const ddTraceBindings = findDdTraceBindings(rootNode);

  const source = rootNode.text();
  const edits: Edit[] = [];
  const metric = useMetricAtom("flatten-ingestion-options");

  for (const ingestionPair of rootNode.findAll({ rule: { kind: "pair" } })) {
    if (keyName(ingestionPair) !== "ingestion") continue;

    const optionsObject = ingestionPair.parent();
    if (!optionsObject || optionsObject.kind() !== "object" || !isDdTraceInitOptionsObject(optionsObject, ddTraceBindings)) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-context" });
      continue;
    }

    const existingTopLevel = new Set(objectPairs(optionsObject).map((pair) => keyName(pair)).filter((name): name is string => Boolean(name)));
    if (existingTopLevel.has("sampleRate") || existingTopLevel.has("rateLimit")) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-conflict" });
      continue;
    }

    const ingestionObject = ingestionPair.field("value");
    if (!ingestionObject || ingestionObject.kind() !== "object") {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-non-object" });
      continue;
    }

    const nestedPairs = objectPairs(ingestionObject);
    if (nestedPairs.length === 0) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-empty" });
      continue;
    }

    const unsupported = nestedPairs.find((pair) => {
      const name = keyName(pair);
      return !name || !INGESTION_KEYS.has(name);
    });
    if (unsupported) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-unsupported-key" });
      continue;
    }

    const replacementParts = nestedPairs.map(pairText);
    if (replacementParts.some((text) => text === null)) continue;

    const indent = lineIndent(source, ingestionPair.range().start.index);
    edits.push(ingestionPair.replace((replacementParts as string[]).join(`,\n${indent}`)));
    metric.increment({ file: metricFile(root.filename()), result: "flattened" });
  }

  if (edits.length === 0) return null;
  return rootNode.commitEdits(edits);
};

export default transform;

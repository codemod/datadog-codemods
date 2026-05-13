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

function keyName(pair: SgNode<TSX> | null): string | null {
  const key = pair?.field("key");
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

function pairText(pair: SgNode<TSX>): string | null {
  const key = pair.field("key");
  const value = pair.field("value");
  if (!key || !value) return null;
  return `${key.text()}: ${value.text()}`;
}

function objectLiteralFromPairs(pairs: SgNode<TSX>[], baseIndent: string): string | null {
  const parts = pairs.map(pairText);
  if (parts.some((text) => text === null)) return null;
  if (parts.length === 0) return "{}";

  const childIndent = `${baseIndent}  `;
  return `{\n${(parts as string[]).map((text) => `${childIndent}${text}`).join(",\n")}\n${baseIndent}}`;
}

function hasImmediateKey(objectNode: SgNode<TSX>, name: string): boolean {
  return objectPairs(objectNode).some((pair) => keyName(pair) === name);
}

function hasRaspBodyCollection(appsecObject: SgNode<TSX>): boolean {
  const raspPair = objectPairs(appsecObject).find((pair) => keyName(pair) === "rasp");
  const raspObject = raspPair?.field("value");
  return Boolean(raspObject && raspObject.kind() === "object" && hasImmediateKey(raspObject, "bodyCollection"));
}

function standaloneEnabledValue(standalonePair: SgNode<TSX> | undefined): SgNode<TSX> | "invalid" | null {
  if (!standalonePair) return null;

  const standaloneObject = standalonePair.field("value");
  if (!standaloneObject || standaloneObject.kind() !== "object") return "invalid";

  const pairs = objectPairs(standaloneObject);
  if (pairs.length !== 1 || keyName(pairs[0] ?? null) !== "enabled") return "invalid";

  return pairs[0]?.field("value") ?? "invalid";
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root();
  const ddTraceBindings = findDdTraceBindings(rootNode);

  const source = rootNode.text();
  const edits: Edit[] = [];
  const metric = useMetricAtom("move-experimental-appsec-options");

  for (const appsecPair of rootNode.findAll({ rule: { kind: "pair" } })) {
    if (keyName(appsecPair) !== "appsec") continue;

    const experimentalObject = appsecPair.parent();
    const experimentalPair = experimentalObject ? valueObjectPair(experimentalObject) : null;
    if (!experimentalObject || experimentalObject.kind() !== "object" || keyName(experimentalPair) !== "experimental") {
      continue;
    }

    const optionsObject = experimentalPair?.parent();
    if (!experimentalPair || !optionsObject || optionsObject.kind() !== "object" || !isDdTraceInitOptionsObject(optionsObject, ddTraceBindings)) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-context" });
      continue;
    }

    const appsecObject = appsecPair.field("value");
    if (!appsecObject || appsecObject.kind() !== "object") {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-non-object" });
      continue;
    }

    if (hasImmediateKey(appsecObject, "extendedHeadersCollection") || hasRaspBodyCollection(appsecObject)) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-remote-config" });
      continue;
    }

    const appsecPairs = objectPairs(appsecObject);
    const standalonePair = appsecPairs.find((pair) => keyName(pair) === "standalone");
    const standaloneValue = standaloneEnabledValue(standalonePair);
    if (standaloneValue === "invalid") {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-standalone-shape" });
      continue;
    }

    const remainingAppsecPairs = appsecPairs.filter((pair) => keyName(pair) !== "standalone");
    const topLevelNames = new Set(objectPairs(optionsObject).map((pair) => keyName(pair)).filter((name): name is string => Boolean(name)));
    if (remainingAppsecPairs.length > 0 && topLevelNames.has("appsec")) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-appsec-conflict" });
      continue;
    }
    if (standaloneValue && topLevelNames.has("apmTracingEnabled")) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-apm-conflict" });
      continue;
    }

    const indent = lineIndent(source, experimentalPair.range().start.index);
    const additions: string[] = [];
    if (remainingAppsecPairs.length > 0) {
      const appsecText = objectLiteralFromPairs(remainingAppsecPairs, indent);
      if (!appsecText) continue;
      additions.push(`appsec: ${appsecText}`);
    }
    if (standaloneValue) {
      additions.push(`apmTracingEnabled: ${standaloneValue.text()}`);
    }
    if (additions.length === 0) {
      metric.increment({ file: metricFile(root.filename()), result: "skipped-empty" });
      continue;
    }

    const experimentalPairs = objectPairs(experimentalObject);
    if (experimentalPairs.length === 1) {
      edits.push(experimentalPair.replace(additions.join(`,\n${indent}`)));
    } else {
      const remainingExperimentalPairs = experimentalPairs.filter((pair) => pair.id() !== appsecPair.id());
      const experimentalText = objectLiteralFromPairs(remainingExperimentalPairs, indent);
      if (!experimentalText) continue;
      edits.push(experimentalPair.replace(`experimental: ${experimentalText},\n${indent}${additions.join(`,\n${indent}`)}`));
    }

    metric.increment({ file: metricFile(root.filename()), result: "moved" });
  }

  if (edits.length === 0) return null;
  return rootNode.commitEdits(edits);
};

export default transform;

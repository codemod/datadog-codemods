import type { Edit, SgNode, Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import { useMetricAtom } from "codemod:metrics";

const RENAMES = new Map([
  ["DD_PROFILING_EXPERIMENTAL_CODEHOTSPOTS_ENABLED", "DD_PROFILING_CODEHOTSPOTS_ENABLED"],
  ["DD_PROFILING_EXPERIMENTAL_CPU_ENABLED", "DD_PROFILING_CPU_ENABLED"],
  ["DD_PROFILING_EXPERIMENTAL_ENDPOINT_COLLECTION_ENABLED", "DD_PROFILING_ENDPOINT_COLLECTION_ENABLED"],
  ["DD_PROFILING_EXPERIMENTAL_TIMELINE_ENABLED", "DD_PROFILING_TIMELINE_ENABLED"],
]);

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

function quotedReplacement(original: string, value: string): string {
  if (original.startsWith("'")) return `'${value}'`;
  return `"${value}"`;
}

function isProcessEnvObject(node: SgNode<TSX> | null | undefined): boolean {
  if (!node || node.kind() !== "member_expression") return false;
  const object = node.field("object");
  const property = node.field("property") ?? node.find({ rule: { kind: "property_identifier" } });
  return object?.text() === "process" && property?.text() === "env";
}

function keyName(pair: SgNode<TSX>): string | null {
  const key = pair.field("key");
  return key ? stripQuotes(key.text()) : null;
}

function isEnvLikeName(name: string | null | undefined): boolean {
  return name === "env" || name === "ENV" || name === "environment" || name === "ENVIRONMENT";
}

function valueObjectPair(objectNode: SgNode<TSX>): SgNode<TSX> | null {
  const parent = objectNode.parent();
  if (parent?.kind() === "pair" && parent.field("value")?.id() === objectNode.id()) return parent;
  return null;
}

function objectVariableName(objectNode: SgNode<TSX>): string | null {
  const parent = objectNode.parent();
  if (parent?.kind() !== "variable_declarator" || parent.field("value")?.id() !== objectNode.id()) return null;
  const name = parent.field("name");
  return name?.kind() === "identifier" ? name.text() : null;
}

function isObjectAssignCall(call: SgNode<TSX>): boolean {
  const fn = call.field("function");
  if (!fn || fn.kind() !== "member_expression") return false;
  const object = fn.field("object");
  const property = fn.field("property") ?? fn.find({ rule: { kind: "property_identifier" } });
  return object?.text() === "Object" && property?.text() === "assign";
}

function namedChildren(node: SgNode<TSX>): SgNode<TSX>[] {
  return node.children().filter((child) => child.isNamed());
}

function callArguments(call: SgNode<TSX>): SgNode<TSX>[] {
  const args = call.field("arguments") ?? call.find({ rule: { kind: "arguments" } });
  return args ? namedChildren(args) : [];
}

function isAssignedIntoProcessEnv(objectNode: SgNode<TSX>): boolean {
  for (const call of objectNode.ancestors().filter((ancestor) => ancestor.kind() === "call_expression")) {
    if (!isObjectAssignCall(call)) continue;
    const args = callArguments(call);
    if (args[0] && isProcessEnvObject(args[0]) && args.some((arg) => arg.id() === objectNode.id())) return true;
  }
  return false;
}

function isEnvConfigObject(objectNode: SgNode<TSX>): boolean {
  if (isEnvLikeName(objectVariableName(objectNode))) return true;

  const pair = valueObjectPair(objectNode);
  if (pair && isEnvLikeName(keyName(pair))) return true;

  return isAssignedIntoProcessEnv(objectNode);
}

function replacePropertyKeys(rootNode: SgNode<TSX, "program">, edits: Edit[], filename: string): void {
  const metric = useMetricAtom("rename-profiling-env-vars");
  for (const pair of rootNode.findAll({ rule: { kind: "pair" } })) {
    const key = pair.field("key");
    if (!key) continue;

    const currentName = stripQuotes(key.text());
    const nextName = RENAMES.get(currentName);
    if (!nextName) continue;

    const objectNode = pair.parent();
    if (!objectNode || objectNode.kind() !== "object" || !isEnvConfigObject(objectNode)) {
      metric.increment({ file: metricFile(filename), env: currentName, result: "skipped-context" });
      continue;
    }

    const replacement = key.text().startsWith("\"") || key.text().startsWith("'")
      ? quotedReplacement(key.text(), nextName)
      : nextName;
    edits.push(key.replace(replacement));
    metric.increment({ file: metricFile(filename), env: currentName, result: "renamed-key" });
  }
}

function replaceProcessEnvMembers(rootNode: SgNode<TSX, "program">, edits: Edit[], filename: string): void {
  const metric = useMetricAtom("rename-profiling-env-vars");

  for (const member of rootNode.findAll({ rule: { kind: "member_expression" } })) {
    const object = member.field("object");
    const property = member.field("property");
    if (!isProcessEnvObject(object) || !property) continue;

    const nextName = RENAMES.get(property.text());
    if (!nextName) continue;

    edits.push(property.replace(nextName));
    metric.increment({ file: metricFile(filename), env: property.text(), result: "renamed-member" });
  }

  for (const subscript of rootNode.findAll({ rule: { kind: "subscript_expression" } })) {
    const object = subscript.field("object");
    const index = subscript.field("index") ?? subscript.find({ rule: { kind: "string" } });
    if (!isProcessEnvObject(object) || !index || index.kind() !== "string") continue;

    const currentName = stripQuotes(index.text());
    const nextName = RENAMES.get(currentName);
    if (!nextName) continue;

    edits.push(index.replace(quotedReplacement(index.text(), nextName)));
    metric.increment({ file: metricFile(filename), env: currentName, result: "renamed-subscript" });
  }
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root();
  const edits: Edit[] = [];

  replacePropertyKeys(rootNode, edits, root.filename());
  replaceProcessEnvMembers(rootNode, edits, root.filename());

  if (edits.length === 0) return null;
  return rootNode.commitEdits(edits);
};

export default transform;

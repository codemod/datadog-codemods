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
  return node?.text() === "process.env";
}

function replacePropertyKeys(rootNode: SgNode<TSX, "program">, edits: Edit[], filename: string): void {
  const metric = useMetricAtom("rename-profiling-env-vars");
  for (const pair of rootNode.findAll({ rule: { kind: "pair" } })) {
    const key = pair.field("key");
    if (!key) continue;

    const currentName = stripQuotes(key.text());
    const nextName = RENAMES.get(currentName);
    if (!nextName) continue;

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

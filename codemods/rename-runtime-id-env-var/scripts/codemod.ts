import type { Edit, SgNode, Transform } from "codemod:ast-grep";
import type TSX from "codemod:ast-grep/langs/tsx";
import { useMetricAtom } from "codemod:metrics";

const OLD_NAME = "DD_TRACE_EXPERIMENTAL_RUNTIME_ID_ENABLED";
const NEW_NAME = "DD_RUNTIME_METRICS_RUNTIME_ID_ENABLED";

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

function quotedReplacement(original: string): string {
  if (original.startsWith("'")) return `'${NEW_NAME}'`;
  return `"${NEW_NAME}"`;
}

function isProcessEnvObject(node: SgNode<TSX> | null | undefined): boolean {
  return node?.text() === "process.env";
}

const transform: Transform<TSX> = async (root) => {
  const rootNode = root.root();
  const edits: Edit[] = [];
  const metric = useMetricAtom("rename-runtime-id-env-var");

  for (const pair of rootNode.findAll({ rule: { kind: "pair" } })) {
    const key = pair.field("key");
    if (!key || stripQuotes(key.text()) !== OLD_NAME) continue;

    const replacement = key.text().startsWith("\"") || key.text().startsWith("'")
      ? quotedReplacement(key.text())
      : NEW_NAME;
    edits.push(key.replace(replacement));
    metric.increment({ file: metricFile(root.filename()), result: "renamed-key" });
  }

  for (const member of rootNode.findAll({ rule: { kind: "member_expression" } })) {
    const object = member.field("object");
    const property = member.field("property");
    if (!isProcessEnvObject(object) || property?.text() !== OLD_NAME) continue;

    edits.push(property.replace(NEW_NAME));
    metric.increment({ file: metricFile(root.filename()), result: "renamed-member" });
  }

  for (const subscript of rootNode.findAll({ rule: { kind: "subscript_expression" } })) {
    const object = subscript.field("object");
    const index = subscript.field("index") ?? subscript.find({ rule: { kind: "string" } });
    if (!isProcessEnvObject(object) || !index || index.kind() !== "string") continue;
    if (stripQuotes(index.text()) !== OLD_NAME) continue;

    edits.push(index.replace(quotedReplacement(index.text())));
    metric.increment({ file: metricFile(root.filename()), result: "renamed-subscript" });
  }

  if (edits.length === 0) return null;
  return rootNode.commitEdits(edits);
};

export default transform;

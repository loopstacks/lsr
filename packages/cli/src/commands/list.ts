import pc from "picocolors";
import { CLIState } from "../state.js";

export function cmdList(dir: string): void {
  const state = new CLIState();
  const result = state.loadDirectory(dir);

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.error(pc.yellow("!"), `${err.file}: ${err.error}`);
    }
  }

  const loops = state.registry.list();
  if (loops.length === 0) {
    console.log(pc.dim("no loops registered"));
    return;
  }

  console.log(pc.bold(`${loops.length} loop${loops.length === 1 ? "" : "s"}:`));
  for (const loop of loops) {
    const kind = kindBadge(loop.kind);
    const version = pc.dim(`v${loop.version}`);
    const desc = loop.description ? pc.dim(`— ${loop.description}`) : "";
    console.log(`  ${kind} ${pc.cyan(loop.id)} ${version} ${desc}`);
  }
}

function kindBadge(kind: string): string {
  switch (kind) {
    case "prompt":
      return pc.blue("[prompt]");
    case "composite":
      return pc.yellow("[composite]");
    case "tool":
      return pc.magenta("[tool]");
    default:
      return pc.dim(`[${kind}]`);
  }
}

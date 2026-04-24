import pc from "picocolors";
import { CLIState } from "../state.js";

export function cmdShow(loopId: string, dir: string): void {
  const state = new CLIState();
  state.loadDirectory(dir);

  const def = state.registry.get(loopId);
  if (!def) {
    console.error(pc.red("✗"), `loop not found: ${loopId}`);
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(def, null, 2));
}

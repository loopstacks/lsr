import pc from "picocolors";
import { CLIState } from "../state.js";

export function cmdLoad(path: string): void {
  const state = new CLIState();
  try {
    const def = state.loadFile(path);
    console.log(pc.green("✓"), `loaded ${pc.bold(def.id)} ${pc.dim(`v${def.version}`)} (${def.kind})`);
  } catch (err) {
    console.error(pc.red("✗"), `failed to load ${path}:`, err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

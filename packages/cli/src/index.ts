#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { cmdLoad } from "./commands/load.js";
import { cmdList } from "./commands/list.js";
import { cmdRun } from "./commands/run.js";
import { cmdShow } from "./commands/show.js";

const program = new Command();

program
  .name("lsr")
  .description("LSR — Loop Stack Runtime. Reference implementation of LSEM.")
  .version("0.1.0");

const DEFAULT_DIR = process.env.LSR_BUNDLE_DIR ?? "./examples";

program
  .command("load <file>")
  .description("Load a loop definition from a JSON file (validates structure)")
  .action((file: string) => {
    cmdLoad(file);
  });

program
  .command("list")
  .description("List loops loaded from the bundle directory")
  .option("-d, --dir <path>", "bundle directory", DEFAULT_DIR)
  .action((options: { dir: string }) => {
    cmdList(options.dir);
  });

program
  .command("show <loopId>")
  .description("Print a loop definition as JSON")
  .option("-d, --dir <path>", "bundle directory", DEFAULT_DIR)
  .action((loopId: string, options: { dir: string }) => {
    cmdShow(loopId, options.dir);
  });

program
  .command("run <loopId>")
  .description("Execute a loop with an input")
  .option("-i, --input <json>", "input as inline JSON")
  .option("-f, --input-file <path>", "input from a JSON file")
  .option("-d, --dir <path>", "bundle directory", DEFAULT_DIR)
  .option("-w, --watch", "render trace tree to stdout")
  .action(async (loopId: string, options: { input?: string; inputFile?: string; dir: string; watch?: boolean }) => {
    await cmdRun(loopId, options);
  });

program.on("command:*", () => {
  console.error(pc.red("unknown command:"), program.args.join(" "));
  program.help({ error: true });
});

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(pc.red("error:"), err instanceof Error ? err.message : err);
  process.exit(1);
});

import type { LoopDef } from "./types.js";

/**
 * LoopRegistry — in-memory catalog of LoopDef records.
 *
 * The registry is the source of truth for what loops exist at runtime.
 * Loops are referenced by id; versions are tracked but v0.1 uses latest-wins
 * semantics (register a new version, it replaces the old one for the id).
 */
export class LoopRegistry {
  private loops = new Map<string, LoopDef>();

  /**
   * Register a loop definition. Validates minimal structural requirements.
   * Throws on missing required fields or kind/body mismatch.
   */
  register(def: LoopDef): void {
    this.validateStructure(def);
    this.loops.set(def.id, def);
  }

  /** Get a loop by id. Returns undefined if not found. */
  get(id: string): LoopDef | undefined {
    return this.loops.get(id);
  }

  /** Get a loop by id, throwing if not found. */
  require(id: string): LoopDef {
    const def = this.loops.get(id);
    if (!def) throw new Error(`loop not found in registry: ${id}`);
    return def;
  }

  /** List all registered loops. */
  list(): LoopDef[] {
    return Array.from(this.loops.values());
  }

  /** Remove a loop by id. Returns true if it existed. */
  remove(id: string): boolean {
    return this.loops.delete(id);
  }

  /** Count of registered loops. */
  size(): number {
    return this.loops.size;
  }

  /** Clear the registry. */
  clear(): void {
    this.loops.clear();
  }

  private validateStructure(def: LoopDef): void {
    if (!def.id) throw new Error("loop def missing required field: id");
    if (!def.name) throw new Error(`loop ${def.id}: missing required field: name`);
    if (!def.version) throw new Error(`loop ${def.id}: missing required field: version`);
    if (!def.inputSchema) throw new Error(`loop ${def.id}: missing required field: inputSchema`);
    if (!def.outputSchema) throw new Error(`loop ${def.id}: missing required field: outputSchema`);
    if (!def.kind) throw new Error(`loop ${def.id}: missing required field: kind`);

    switch (def.kind) {
      case "prompt":
        if (!def.prompt) throw new Error(`loop ${def.id}: kind=prompt requires prompt spec`);
        if (!def.prompt.template) throw new Error(`loop ${def.id}: prompt.template is required`);
        if (!Array.isArray(def.prompt.variables)) {
          throw new Error(`loop ${def.id}: prompt.variables must be an array`);
        }
        break;
      case "composite":
        if (!def.composite) throw new Error(`loop ${def.id}: kind=composite requires composite spec`);
        if (!Array.isArray(def.composite.steps) || def.composite.steps.length === 0) {
          throw new Error(`loop ${def.id}: composite.steps must be a non-empty array`);
        }
        break;
      case "tool":
        if (!def.tool) throw new Error(`loop ${def.id}: kind=tool requires tool spec`);
        if (!def.tool.implementation) {
          throw new Error(`loop ${def.id}: tool.implementation is required`);
        }
        break;
      default:
        throw new Error(`loop ${def.id}: unknown kind: ${(def as LoopDef).kind}`);
    }
  }
}

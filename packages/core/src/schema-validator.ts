import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { JSONSchema } from "./types.js";

/**
 * Thin wrapper around ajv for validating loop inputs and outputs against
 * their declared JSON schemas. Compiled validators are cached per schema
 * object identity.
 */
export class SchemaValidator {
  private ajv: Ajv;
  private cache = new WeakMap<object, ValidateFunction>();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      useDefaults: true,
      coerceTypes: false,
      strict: false,
    });
    addFormats(this.ajv);
  }

  /**
   * Validate data against a schema.
   * Returns { valid: true } on success, or { valid: false, errors } on failure.
   */
  validate(
    schema: JSONSchema,
    data: unknown,
  ): { valid: true } | { valid: false; errors: string[] } {
    let validator = this.cache.get(schema);
    if (!validator) {
      validator = this.ajv.compile(schema);
      this.cache.set(schema, validator);
    }

    const valid = validator(data);
    if (valid) return { valid: true };

    const errors = (validator.errors ?? []).map((err) => {
      const path = err.instancePath || "(root)";
      return `${path}: ${err.message ?? "invalid"}`;
    });
    return { valid: false, errors };
  }
}

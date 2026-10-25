import { normalizeSpec, findOperation, findResponseSchema } from './openapi.js';
import { validateAgainstSchema, detectDrift, describeSchemaType } from './schemaTools.js';

/**
 * Validates an observed response against the saved specification and reports contract drift.
 * `path` may be the spec path template (`/pets/{id}`) or a concrete path (`/pets/42`).
 */
export function checkContract(doc, { method, path, status, data }) {
  const normalized = normalizeSpec(doc);
  const operation = findOperation(normalized, method, path);
  if (!operation) {
    return { matched: false, reason: `No operation for ${String(method).toUpperCase()} ${path} exists in the saved specification.` };
  }

  const found = findResponseSchema(operation, status);
  const base = { matched: true, operation: operation.key, status, declaredStatuses: Object.keys(operation.responses) };
  if (!found) {
    return {
      ...base,
      hasSchema: false,
      reason: `The specification does not declare a ${status} response for ${operation.key}.`,
      validation: { valid: false, errors: [{ path: '$', message: `Status ${status} is not documented in the specification`, actual: String(status) }] },
      drift: null,
    };
  }

  const { response, status: matchedStatus } = found;
  if (!response.schema) {
    return {
      ...base,
      matchedStatus,
      hasSchema: false,
      reason: `Response ${matchedStatus} has no schema to validate against.`,
      validation: null,
      drift: null,
    };
  }

  const errors = validateAgainstSchema(doc, response.schema, data);
  return {
    ...base,
    matchedStatus,
    hasSchema: true,
    expectedType: describeSchemaType(response.schema),
    validation: { valid: errors.length === 0, errors },
    drift: detectDrift(doc, response.schema, data),
  };
}

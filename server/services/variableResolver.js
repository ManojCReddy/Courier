import crypto from 'crypto';

/**
 * Resolves dynamic built-ins and user-defined environment variables.
 * Format: {{variableName}}
 */
export function resolveVariables(text, environment = {}) {
  if (typeof text !== 'string') return text;

  // Dynamic generators
  const dynamicVars = {
    '$guid': () => crypto.randomUUID(),
    '$uuid': () => crypto.randomUUID(),
    '$timestamp': () => Math.floor(Date.now() / 1000).toString(),
    '$isoTimestamp': () => new Date().toISOString(),
    '$randomInt': () => Math.floor(Math.random() * 10000).toString(),
    '$randomEmail': () => `user_${Math.floor(Math.random() * 10000)}@test.com`,
  };

  return text.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    if (dynamicVars[trimmedKey]) {
      return dynamicVars[trimmedKey]();
    }
    if (environment && environment[trimmedKey] !== undefined && environment[trimmedKey] !== null) {
      return String(environment[trimmedKey]);
    }
    return match; // Return as-is if unresolvable
  });
}

/**
 * Recursively resolves variables across objects (e.g. headers, body)
 */
export function resolveDeep(obj, environment = {}) {
  if (typeof obj === 'string') {
    return resolveVariables(obj, environment);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => resolveDeep(item, environment));
  }
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveDeep(v, environment);
    }
    return result;
  }
  return obj;
}


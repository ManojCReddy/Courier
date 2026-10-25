// Schema helpers shared by OpenAPI import, response validation and contract drift.
// Schemas are plain JSON-Schema-like objects; `$ref`s are resolved lazily against the spec document.

const MAX_REF_DEPTH = 32;

export function resolveRef(doc, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return undefined;
  let node = doc;
  for (const rawPart of ref.slice(2).split('/')) {
    const part = rawPart.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

export function refName(ref) {
  return typeof ref === 'string' ? ref.split('/').pop() : undefined;
}

// Follows a chain of $refs until a concrete schema is reached.
export function deref(doc, schema) {
  let current = schema;
  for (let i = 0; i < MAX_REF_DEPTH; i++) {
    if (current && typeof current === 'object' && typeof current.$ref === 'string') {
      const next = resolveRef(doc, current.$ref);
      if (next === undefined) return {};
      current = next;
    } else {
      break;
    }
  }
  return current && typeof current === 'object' ? current : {};
}

// Flattens allOf into a single effective schema (properties/required/items are merged).
export function effectiveSchema(doc, schema, depth = 0) {
  const base = deref(doc, schema);
  if (!Array.isArray(base.allOf) || depth > MAX_REF_DEPTH) return base;
  const merged = { ...base };
  delete merged.allOf;
  for (const part of base.allOf) {
    const eff = effectiveSchema(doc, part, depth + 1);
    if (eff.properties) merged.properties = { ...(merged.properties || {}), ...eff.properties };
    if (Array.isArray(eff.required)) merged.required = [...new Set([...(merged.required || []), ...eff.required])];
    if (eff.type && !merged.type) merged.type = eff.type;
    if (eff.items && !merged.items) merged.items = eff.items;
    if (eff.additionalProperties !== undefined && merged.additionalProperties === undefined) {
      merged.additionalProperties = eff.additionalProperties;
    }
    if (eff.enum && !merged.enum) merged.enum = eff.enum;
    if (eff.oneOf && !merged.oneOf) merged.oneOf = eff.oneOf;
    if (eff.anyOf && !merged.anyOf) merged.anyOf = eff.anyOf;
  }
  return merged;
}

export function declaredTypes(schema) {
  let types = [];
  if (Array.isArray(schema.type)) types = [...schema.type];
  else if (typeof schema.type === 'string') types = [schema.type];
  else if (schema.properties || schema.additionalProperties !== undefined) types = ['object'];
  else if (schema.items) types = ['array'];
  if ((schema.nullable === true || schema['x-nullable'] === true) && types.length && !types.includes('null')) {
    types.push('null');
  }
  return types;
}

export function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function typeMatches(expectedTypes, actual) {
  return expectedTypes.some(t => t === actual || (t === 'number' && actual === 'integer'));
}

export function describeSchemaType(schema) {
  if (!schema || typeof schema !== 'object') return 'any';
  if (schema.$ref) return refName(schema.$ref) || 'object';
  if (schema.allOf) return schema.allOf.map(describeSchemaType).join(' & ');
  if (schema.oneOf) return schema.oneOf.map(describeSchemaType).join(' | ');
  if (schema.anyOf) return schema.anyOf.map(describeSchemaType).join(' | ');
  const types = declaredTypes(schema);
  const primary = types.filter(t => t !== 'null');
  let label = primary.join(' | ') || 'any';
  if (primary.includes('array')) {
    label = `array<${schema.items ? describeSchemaType(schema.items) : 'any'}>`;
  } else if (primary.length === 1 && schema.format) {
    label = `${primary[0]} (${schema.format})`;
  } else if (primary.includes('object') && schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    label = `map<${describeSchemaType(schema.additionalProperties)}>`;
  }
  if (schema.enum) label += ` enum`;
  if (types.includes('null')) label += ' | null';
  return label;
}

// Direct $ref targets (model names) used by a schema, without descending into the referenced models.
export function collectRefs(schema, out = new Set(), seen = new Set()) {
  if (!schema || typeof schema !== 'object' || seen.has(schema)) return out;
  seen.add(schema);
  if (typeof schema.$ref === 'string') {
    out.add(refName(schema.$ref));
    return out;
  }
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    if (Array.isArray(schema[key])) schema[key].forEach(s => collectRefs(s, out, seen));
  }
  if (schema.items) collectRefs(schema.items, out, seen);
  if (schema.properties) Object.values(schema.properties).forEach(s => collectRefs(s, out, seen));
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    collectRefs(schema.additionalProperties, out, seen);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Example generation
// ---------------------------------------------------------------------------

function formatExample(schema) {
  switch (schema.format) {
    case 'date-time': return '2024-01-01T00:00:00Z';
    case 'date': return '2024-01-01';
    case 'email': return 'user@example.com';
    case 'uuid': return '00000000-0000-4000-8000-000000000000';
    case 'uri': case 'url': return 'https://example.com';
    case 'hostname': return 'example.com';
    case 'ipv4': return '127.0.0.1';
    case 'password': return 'password';
    case 'byte': return 'U3RyaW5n';
    default: return 'string';
  }
}

export function generateExample(doc, schema, options = {}, trail = []) {
  const { includeReadOnly = false } = options;
  if (!schema || typeof schema !== 'object') return null;

  if (typeof schema.$ref === 'string') {
    if (trail.includes(schema.$ref) || trail.length > 12) return null;
    return generateExample(doc, deref(doc, schema), options, [...trail, schema.$ref]);
  }
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];

  const eff = effectiveSchema(doc, schema);
  if (eff !== schema && eff.example !== undefined) return eff.example;
  const variants = eff.oneOf || eff.anyOf;
  if (variants && variants.length) return generateExample(doc, variants[0], options, trail);

  const types = declaredTypes(eff).filter(t => t !== 'null');
  const type = types[0];
  switch (type) {
    case 'object': {
      const result = {};
      for (const [name, prop] of Object.entries(eff.properties || {})) {
        const concrete = deref(doc, prop);
        if (concrete.readOnly && !includeReadOnly) continue;
        result[name] = generateExample(doc, prop, options, trail);
      }
      return result;
    }
    case 'array':
      return eff.items ? [generateExample(doc, eff.items, options, trail)] : [];
    case 'integer':
      return typeof eff.minimum === 'number' ? eff.minimum : 0;
    case 'number':
      return typeof eff.minimum === 'number' ? eff.minimum : 0;
    case 'boolean':
      return true;
    case 'string':
      return formatExample(eff);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function joinPath(path, key) {
  if (typeof key === 'number') return `${path}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function preview(value) {
  const text = JSON.stringify(value);
  if (text === undefined) return String(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

/**
 * Validates `value` against `schema`. Returns [{ path, message, expected?, actual? }].
 * Paths use JSONPath-like notation, e.g. `$.items[2].owner.id`.
 */
export function validateAgainstSchema(doc, schema, value, path = '$', trail = []) {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;

  if (typeof schema.$ref === 'string') {
    if (trail.filter(r => r === schema.$ref).length > 8) return errors;
    return validateAgainstSchema(doc, deref(doc, schema), value, path, [...trail, schema.$ref]);
  }

  const eff = effectiveSchema(doc, schema);
  const actual = valueType(value);
  const types = declaredTypes(eff);

  if (value === null && types.length && !types.includes('null')) {
    errors.push({ path, message: 'Value is null but the schema does not allow null', expected: types.join(' | '), actual: 'null' });
    return errors;
  }
  if (value === null && !types.length && eff.nullable === false) {
    errors.push({ path, message: 'Value is null but the schema does not allow null', actual: 'null' });
    return errors;
  }

  if (value !== null && types.length && !typeMatches(types, actual)) {
    errors.push({
      path,
      message: `Expected ${types.filter(t => t !== 'null').join(' | ')} but received ${actual}`,
      expected: types.join(' | '),
      actual,
    });
    return errors;
  }

  if (Array.isArray(eff.enum) && !eff.enum.some(item => deepEqual(item, value))) {
    errors.push({ path, message: `Value ${preview(value)} is not one of ${preview(eff.enum)}`, expected: preview(eff.enum), actual: preview(value) });
  }

  const variants = eff.oneOf || eff.anyOf;
  if (variants && variants.length) {
    const results = variants.map(v => validateAgainstSchema(doc, v, value, path, trail));
    const passing = results.filter(r => r.length === 0).length;
    if (passing === 0) {
      const best = results.reduce((a, b) => (b.length < a.length ? b : a));
      errors.push({ path, message: `Value does not match any of ${variants.length} allowed schemas`, expected: describeSchemaType(eff) });
      errors.push(...best);
    } else if (eff.oneOf && passing > 1) {
      errors.push({ path, message: `Value matches ${passing} schemas but must match exactly one (oneOf)` });
    }
  }

  if (actual === 'object') {
    const props = eff.properties || {};
    for (const required of eff.required || []) {
      if (!(required in value)) {
        errors.push({ path: joinPath(path, required), message: `Required property "${required}" is missing`, expected: describeSchemaType(props[required]) });
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (props[key]) {
        errors.push(...validateAgainstSchema(doc, props[key], child, joinPath(path, key), trail));
      } else if (eff.additionalProperties === false) {
        errors.push({ path: joinPath(path, key), message: `Property "${key}" is not allowed by the schema`, actual: valueType(child) });
      } else if (eff.additionalProperties && typeof eff.additionalProperties === 'object') {
        errors.push(...validateAgainstSchema(doc, eff.additionalProperties, child, joinPath(path, key), trail));
      }
    }
  } else if (actual === 'array') {
    if (typeof eff.minItems === 'number' && value.length < eff.minItems) {
      errors.push({ path, message: `Array has ${value.length} items; minimum is ${eff.minItems}` });
    }
    if (typeof eff.maxItems === 'number' && value.length > eff.maxItems) {
      errors.push({ path, message: `Array has ${value.length} items; maximum is ${eff.maxItems}` });
    }
    if (eff.items) {
      value.forEach((item, index) => errors.push(...validateAgainstSchema(doc, eff.items, item, joinPath(path, index), trail)));
    }
  } else if (actual === 'string') {
    if (typeof eff.minLength === 'number' && value.length < eff.minLength) {
      errors.push({ path, message: `String is shorter than minLength ${eff.minLength}`, actual: preview(value) });
    }
    if (typeof eff.maxLength === 'number' && value.length > eff.maxLength) {
      errors.push({ path, message: `String is longer than maxLength ${eff.maxLength}`, actual: preview(value) });
    }
    if (typeof eff.pattern === 'string') {
      try {
        if (!new RegExp(eff.pattern).test(value)) {
          errors.push({ path, message: `String does not match pattern ${eff.pattern}`, actual: preview(value) });
        }
      } catch {
        // Ignore patterns that JS cannot compile.
      }
    }
  } else if (actual === 'number' || actual === 'integer') {
    if (typeof eff.minimum === 'number' && value < eff.minimum) {
      errors.push({ path, message: `Value ${value} is below minimum ${eff.minimum}`, actual: String(value) });
    }
    if (typeof eff.maximum === 'number' && value > eff.maximum) {
      errors.push({ path, message: `Value ${value} is above maximum ${eff.maximum}`, actual: String(value) });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Contract drift
// ---------------------------------------------------------------------------

/**
 * Compares an observed value against the schema and reports:
 *  - added:       fields present in the response but not declared in the spec
 *  - missing:     fields declared in the spec but absent from the response
 *  - typeChanged: fields whose observed type differs from the declared type
 * Array elements share a `[]` path so repeated findings collapse into one entry.
 */
export function detectDrift(doc, schema, value) {
  const added = new Map();
  const typeChanged = new Map();
  const presence = new Map();

  const walk = (rawSchema, current, path, trail) => {
    if (!rawSchema || typeof rawSchema !== 'object') return;
    if (typeof rawSchema.$ref === 'string') {
      if (trail.filter(r => r === rawSchema.$ref).length > 8) return;
      walk(deref(doc, rawSchema), current, path, [...trail, rawSchema.$ref]);
      return;
    }

    let eff = effectiveSchema(doc, rawSchema);
    const variants = eff.oneOf || eff.anyOf;
    if (variants && variants.length) {
      const match = variants.find(v => validateAgainstSchema(doc, v, current, path).length === 0)
        || variants.find(v => declaredTypes(effectiveSchema(doc, v)).some(t => typeMatches([t], valueType(current))));
      if (match) walk(match, current, path, trail);
      return;
    }

    const types = declaredTypes(eff);
    const actual = valueType(current);

    if (types.length && !(current === null ? types.includes('null') : typeMatches(types, actual))) {
      const key = `${path}|${actual}`;
      if (!typeChanged.has(key)) {
        typeChanged.set(key, { path, expected: types.join(' | '), observed: actual });
      }
      return;
    }

    if (actual === 'object') {
      const props = eff.properties || {};
      const required = new Set(eff.required || []);
      for (const name of Object.keys(props)) {
        const childPath = `${path}.${name}`;
        const entry = presence.get(childPath) || { seen: 0, absent: 0, required: required.has(name) };
        if (name in current) entry.seen += 1;
        else entry.absent += 1;
        presence.set(childPath, entry);
      }
      for (const [key, child] of Object.entries(current)) {
        const childPath = `${path}.${key}`;
        if (props[key]) {
          walk(props[key], child, childPath, trail);
        } else if (eff.additionalProperties && typeof eff.additionalProperties === 'object') {
          walk(eff.additionalProperties, child, `${path}.*`, trail);
        } else if (eff.additionalProperties !== true && Object.keys(props).length > 0) {
          const existing = added.get(childPath);
          if (existing) existing.occurrences += 1;
          else added.set(childPath, { path: childPath, observed: valueType(child), occurrences: 1 });
        }
      }
    } else if (actual === 'array' && eff.items) {
      for (const item of current) walk(eff.items, item, `${path}[]`, trail);
    }
  };

  walk(schema, value, '$', []);

  const missing = [];
  for (const [path, entry] of presence) {
    if (entry.absent > 0) {
      missing.push({
        path,
        required: entry.required,
        absentIn: entry.absent,
        of: entry.absent + entry.seen,
      });
    }
  }

  const result = {
    added: [...added.values()],
    missing,
    typeChanged: [...typeChanged.values()],
  };
  result.summary = {
    added: result.added.length,
    missing: result.missing.length,
    typeChanged: result.typeChanged.length,
    total: result.added.length + result.missing.length + result.typeChanged.length,
  };
  return result;
}

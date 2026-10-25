import YAML from 'yaml';
import crypto from 'crypto';
import {
  deref,
  effectiveSchema,
  describeSchemaType,
  collectRefs,
  declaredTypes,
  generateExample,
  resolveRef,
} from './schemaTools.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];
const JSON_MEDIA = /^application\/(?:[\w.+-]*\+)?json(?:\s*;.*)?$/i;

export function parseSpecText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('The specification file is empty.');
  }
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  let doc;
  try {
    doc = trimmed.startsWith('{') ? JSON.parse(trimmed) : YAML.parse(trimmed);
  } catch {
    try {
      doc = YAML.parse(trimmed);
    } catch (yamlErr) {
      throw new Error(`Could not parse the file as JSON or YAML: ${yamlErr.message}`);
    }
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new Error('The specification must be a JSON/YAML object.');
  }
  return doc;
}

export function detectSpecVersion(doc) {
  if (typeof doc.swagger === 'string' && doc.swagger.startsWith('2')) {
    return { kind: 'swagger2', label: `Swagger ${doc.swagger}` };
  }
  if (typeof doc.openapi === 'string' && /^3\.[01]/.test(doc.openapi)) {
    return { kind: 'oas3', label: `OpenAPI ${doc.openapi}` };
  }
  if (doc.openapi) {
    throw new Error(`Unsupported OpenAPI version "${doc.openapi}". Courier supports OpenAPI 3.0/3.1 and Swagger 2.0.`);
  }
  throw new Error('Not an OpenAPI or Swagger document (missing "openapi" or "swagger" field).');
}

export function getModels(doc, kind = detectSpecVersion(doc).kind) {
  return (kind === 'swagger2' ? doc.definitions : doc.components?.schemas) || {};
}

function resolveParameter(doc, param) {
  const concrete = param && param.$ref ? resolveRef(doc, param.$ref) : param;
  return concrete && typeof concrete === 'object' ? concrete : null;
}

function pickMedia(content) {
  if (!content || typeof content !== 'object') return null;
  const entries = Object.entries(content);
  if (!entries.length) return null;
  const json = entries.find(([type]) => JSON_MEDIA.test(type));
  const [contentType, media] = json || entries[0];
  return { contentType, media: media || {} };
}

function firstExample(media) {
  if (media.example !== undefined) return media.example;
  const examples = media.examples && Object.values(media.examples)[0];
  return examples?.value;
}

function paramSchema(param) {
  if (param.schema) return param.schema;
  const { type, format, items, enum: enumValues, default: def, minimum, maximum } = param;
  return { type, format, items, enum: enumValues, default: def, minimum, maximum };
}

/** Normalizes OpenAPI 3.x and Swagger 2.0 into a single operation list. */
export function normalizeSpec(doc) {
  const version = detectSpecVersion(doc);
  const isV2 = version.kind === 'swagger2';
  const warnings = [];
  const operations = [];
  const globalConsumes = doc.consumes || ['application/json'];
  const globalProduces = doc.produces || ['application/json'];

  for (const [path, pathItem] of Object.entries(doc.paths || {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    const sharedParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op || typeof op !== 'object') continue;

      const merged = new Map();
      for (const raw of [...sharedParams, ...(op.parameters || [])]) {
        const param = resolveParameter(doc, raw);
        if (!param || !param.name) {
          warnings.push(`${method.toUpperCase()} ${path}: skipped an unresolved parameter reference`);
          continue;
        }
        merged.set(`${param.in}:${param.name}`, param);
      }
      const parameters = [...merged.values()];

      let requestBody = null;
      if (isV2) {
        const bodyParam = parameters.find(p => p.in === 'body');
        const formParams = parameters.filter(p => p.in === 'formData');
        const consumes = op.consumes || globalConsumes;
        if (bodyParam) {
          requestBody = {
            contentType: consumes.find(c => JSON_MEDIA.test(c)) || consumes[0] || 'application/json',
            schema: bodyParam.schema || {},
            required: !!bodyParam.required,
            example: bodyParam.schema?.example,
          };
        } else if (formParams.length) {
          const isMultipart = consumes.some(c => /multipart\/form-data/i.test(c)) && !consumes.some(c => /urlencoded/i.test(c));
          requestBody = {
            contentType: isMultipart ? 'multipart/form-data' : 'application/x-www-form-urlencoded',
            schema: {
              type: 'object',
              properties: Object.fromEntries(formParams.map(p => [p.name, paramSchema(p)])),
              required: formParams.filter(p => p.required).map(p => p.name),
            },
            required: formParams.some(p => p.required),
          };
        }
      } else if (op.requestBody) {
        const body = op.requestBody.$ref ? resolveRef(doc, op.requestBody.$ref) : op.requestBody;
        const picked = pickMedia(body?.content);
        if (picked) {
          requestBody = {
            contentType: picked.contentType,
            schema: picked.media.schema || {},
            required: !!body.required,
            example: firstExample(picked.media),
          };
        }
      }

      const responses = {};
      for (const [status, rawResponse] of Object.entries(op.responses || {})) {
        const response = rawResponse?.$ref ? resolveRef(doc, rawResponse.$ref) : rawResponse;
        if (!response) continue;
        if (isV2) {
          const produces = op.produces || globalProduces;
          responses[status] = {
            description: response.description || '',
            contentType: produces.find(c => JSON_MEDIA.test(c)) || produces[0] || 'application/json',
            schema: response.schema || null,
          };
        } else {
          const picked = pickMedia(response.content);
          responses[status] = {
            description: response.description || '',
            contentType: picked?.contentType || null,
            schema: picked?.media.schema || null,
          };
        }
      }

      operations.push({
        key: `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase(),
        path,
        operationId: op.operationId,
        summary: op.summary || '',
        description: op.description || '',
        tags: Array.isArray(op.tags) ? op.tags : [],
        deprecated: !!op.deprecated,
        parameters: parameters.filter(p => ['path', 'query', 'header', 'cookie'].includes(p.in)),
        requestBody,
        responses,
        security: op.security !== undefined ? op.security : doc.security || [],
      });
    }
  }

  return {
    version,
    info: {
      title: doc.info?.title || 'Imported API',
      version: doc.info?.version || '',
      description: doc.info?.description || '',
    },
    servers: extractServers(doc, isV2),
    securitySchemes: extractSecuritySchemes(doc, isV2),
    operations,
    models: getModels(doc, version.kind),
    warnings,
  };
}

function extractServers(doc, isV2) {
  if (isV2) {
    if (!doc.host) return [];
    const scheme = (doc.schemes && doc.schemes[0]) || 'https';
    const basePath = doc.basePath && doc.basePath !== '/' ? doc.basePath : '';
    return [{ url: `${scheme}://${doc.host}${basePath}`.replace(/\/$/, '') }];
  }
  return (doc.servers || []).filter(s => s && s.url).map(server => {
    let url = server.url;
    for (const [name, variable] of Object.entries(server.variables || {})) {
      url = url.replace(`{${name}}`, variable.default ?? '');
    }
    return { url: url.replace(/\/$/, ''), description: server.description };
  });
}

function extractSecuritySchemes(doc, isV2) {
  const raw = (isV2 ? doc.securityDefinitions : doc.components?.securitySchemes) || {};
  const schemes = {};
  for (const [name, scheme] of Object.entries(raw)) {
    const resolved = scheme?.$ref ? resolveRef(doc, scheme.$ref) : scheme;
    if (!resolved) continue;
    if (isV2) {
      if (resolved.type === 'basic') schemes[name] = { kind: 'basic' };
      else if (resolved.type === 'apiKey') schemes[name] = { kind: 'apiKey', in: resolved.in, name: resolved.name };
      else if (resolved.type === 'oauth2') schemes[name] = { kind: 'oauth2' };
    } else if (resolved.type === 'http') {
      const httpScheme = (resolved.scheme || '').toLowerCase();
      schemes[name] = { kind: httpScheme === 'basic' ? 'basic' : 'bearer' };
    } else if (resolved.type === 'apiKey') {
      schemes[name] = { kind: 'apiKey', in: resolved.in, name: resolved.name };
    } else if (resolved.type === 'oauth2' || resolved.type === 'openIdConnect') {
      schemes[name] = { kind: 'oauth2' };
    }
  }
  return schemes;
}

function authForOperation(op, schemes) {
  const requirement = (op.security || []).find(r => r && Object.keys(r).length > 0);
  if (!requirement) return { auth: { type: 'none' }, variables: [] };
  const schemeName = Object.keys(requirement).find(name => schemes[name]);
  const scheme = schemeName && schemes[schemeName];
  if (!scheme) return { auth: { type: 'none' }, variables: [] };

  switch (scheme.kind) {
    case 'basic':
      return {
        auth: { type: 'basic', basicUsername: '{{username}}', basicPassword: '{{password}}' },
        variables: ['username', 'password'],
      };
    case 'bearer':
      return { auth: { type: 'bearer', bearerToken: '{{token}}' }, variables: ['token'] };
    case 'oauth2':
      return { auth: { type: 'bearer', bearerToken: '{{accessToken}}' }, variables: ['accessToken'] };
    case 'apiKey':
      return {
        auth: {
          type: 'apiKey',
          apiKeyName: scheme.name,
          apiKeyValue: '{{apiKey}}',
          // Cookie-based keys are not supported by the auth editor; fall back to a header.
          apiKeyPlacement: scheme.in === 'query' ? 'query' : 'header',
        },
        variables: ['apiKey'],
      };
    default:
      return { auth: { type: 'none' }, variables: [] };
  }
}

function sampleParamValue(doc, param) {
  const example = param.example !== undefined ? param.example : generateExample(doc, paramSchema(param));
  if (Array.isArray(example)) return example.join(',');
  if (example && typeof example === 'object') return JSON.stringify(example);
  return example === null || example === undefined ? '' : String(example);
}

function buildRequest(doc, normalized, op, specId, index) {
  const { auth, variables } = authForOperation(op, normalized.securitySchemes);
  const params = [];
  const pathParams = [];
  const headers = [];

  for (const param of op.parameters) {
    const value = sampleParamValue(doc, param);
    const description = param.description || undefined;
    if (param.in === 'path') {
      pathParams.push({ key: param.name, value, enabled: true, description });
    } else if (param.in === 'query') {
      params.push({ key: param.name, value, enabled: !!param.required, description });
    } else if (param.in === 'header') {
      headers.push({ key: param.name, value, enabled: !!param.required, description });
    }
  }

  let bodyType = 'none';
  let rawFormat;
  let body = '';
  if (op.requestBody) {
    const { contentType, schema, example } = op.requestBody;
    const sample = example !== undefined ? example : generateExample(doc, schema);
    if (JSON_MEDIA.test(contentType) || contentType.startsWith('*/*')) {
      bodyType = 'json';
      body = JSON.stringify(sample === undefined ? {} : sample, null, 2);
      headers.push({ key: 'Content-Type', value: 'application/json', enabled: true });
    } else if (/x-www-form-urlencoded|multipart\/form-data/i.test(contentType)) {
      bodyType = /multipart/i.test(contentType) ? 'formdata' : 'urlencoded';
      const fields = sample && typeof sample === 'object' ? Object.entries(sample) : [];
      body = JSON.stringify(fields.map(([key, value]) => ({
        key,
        value: value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''),
        enabled: true,
      })));
    } else if (/xml/i.test(contentType)) {
      bodyType = 'raw';
      rawFormat = 'xml';
      body = typeof sample === 'string' ? sample : '<root></root>';
    } else {
      bodyType = 'raw';
      rawFormat = 'text';
      body = typeof sample === 'string' ? sample : '';
    }
  }

  const accept = Object.values(op.responses).find(r => r.contentType)?.contentType;
  if (accept && !headers.some(h => h.key.toLowerCase() === 'accept')) {
    headers.push({ key: 'Accept', value: accept, enabled: true });
  }

  const successStatuses = Object.keys(op.responses).filter(s => /^2\d\d$/.test(s));
  const assertion = successStatuses.length === 1
    ? { id: `a-${specId}-${index}`, name: `Status is ${successStatuses[0]}`, type: 'STATUS_CODE_EQUALS', expected: successStatuses[0], enabled: true }
    : { id: `a-${specId}-${index}`, name: 'Status is 2xx', type: 'STATUS_IS_2XX', expected: '', enabled: true };

  const request = {
    id: `req-${specId}-${index}`,
    name: op.summary || op.operationId || op.key,
    method: op.method,
    url: `{{baseUrl}}${op.path}`,
    params,
    pathParams,
    headers,
    auth,
    bodyType,
    body,
    assertions: [assertion],
    openapi: { specId, method: op.method, path: op.path },
  };
  if (rawFormat) request.rawFormat = rawFormat;
  return { request, variables };
}

export function buildCollection(doc, specId, options = {}) {
  const normalized = normalizeSpec(doc);
  const folders = new Map();
  const rootRequests = [];
  const extraVariables = new Set();

  normalized.operations.forEach((op, index) => {
    const { request, variables } = buildRequest(doc, normalized, op, specId, index);
    variables.forEach(v => extraVariables.add(v));
    const tag = op.tags[0];
    if (!tag) {
      rootRequests.push(request);
      return;
    }
    if (!folders.has(tag)) {
      folders.set(tag, { id: `folder-${specId}-${folders.size}`, name: tag, requests: [] });
    }
    folders.get(tag).requests.push(request);
  });

  const baseUrl = options.baseUrl || normalized.servers[0]?.url || 'https://api.example.com';
  return {
    id: specId,
    name: options.name || normalized.info.title,
    description: normalized.info.description
      ? normalized.info.description.slice(0, 500)
      : `Imported from ${normalized.version.label}`,
    requests: rootRequests,
    folders: [...folders.values()],
    variables: [
      { key: 'baseUrl', value: baseUrl, enabled: true },
      ...[...extraVariables].map(key => ({ key, value: '', enabled: true })),
    ],
  };
}

export function previewSpec(doc) {
  const normalized = normalizeSpec(doc);
  const tags = new Map();
  const methods = {};
  for (const op of normalized.operations) {
    const tag = op.tags[0] || 'Untagged';
    tags.set(tag, (tags.get(tag) || 0) + 1);
    methods[op.method] = (methods[op.method] || 0) + 1;
  }

  const warnings = [...normalized.warnings];
  if (!normalized.operations.length) warnings.push('No operations were found under "paths".');
  if (!normalized.servers.length) warnings.push('No server URL was declared; baseUrl will default to https://api.example.com.');

  return {
    version: normalized.version.label,
    info: normalized.info,
    servers: normalized.servers,
    security: Object.entries(normalized.securitySchemes).map(([schemeName, scheme]) => ({ ...scheme, name: schemeName, paramName: scheme.name })),
    counts: {
      endpoints: normalized.operations.length,
      models: Object.keys(normalized.models).length,
      folders: tags.size,
      methods,
    },
    folders: [...tags.entries()].map(([name, count]) => ({ name, count })),
    endpoints: normalized.operations.map(op => ({
      method: op.method,
      path: op.path,
      name: op.summary || op.operationId || op.key,
      tag: op.tags[0] || 'Untagged',
      hasBody: !!op.requestBody,
      deprecated: op.deprecated,
    })),
    warnings,
  };
}

export function newSpecId() {
  return `col-${crypto.randomUUID().slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// API map (endpoints + models)
// ---------------------------------------------------------------------------

function fieldList(doc, schema) {
  const eff = effectiveSchema(doc, schema);
  const required = new Set(eff.required || []);
  return Object.entries(eff.properties || {}).map(([name, prop]) => {
    const concrete = deref(doc, prop);
    return {
      name,
      type: describeSchemaType(prop),
      required: required.has(name),
      nullable: declaredTypes(concrete).includes('null'),
      description: concrete.description || '',
      refs: [...collectRefs(prop)],
    };
  });
}

export function buildApiMap(doc) {
  const normalized = normalizeSpec(doc);
  const modelNames = Object.keys(normalized.models);
  const known = new Set(modelNames);

  const directRefs = {};
  for (const [name, schema] of Object.entries(normalized.models)) {
    directRefs[name] = [...collectRefs(schema)].filter(ref => known.has(ref));
  }

  const reach = (start) => {
    const seen = new Set(start);
    const queue = [...start];
    while (queue.length) {
      for (const ref of directRefs[queue.shift()] || []) {
        if (!seen.has(ref)) {
          seen.add(ref);
          queue.push(ref);
        }
      }
    }
    return seen;
  };

  const onlyKnown = (names) => names.filter(name => known.has(name));

  const endpoints = normalized.operations.map(op => {
    const requestModels = op.requestBody ? onlyKnown([...collectRefs(op.requestBody.schema)]) : [];
    const responses = Object.entries(op.responses).map(([status, r]) => ({
      status,
      description: r.description,
      contentType: r.contentType,
      type: r.schema ? describeSchemaType(r.schema) : null,
      models: r.schema ? onlyKnown([...collectRefs(r.schema)]) : [],
    }));
    const parameterModels = onlyKnown(op.parameters.flatMap(p => [...collectRefs(paramSchema(p))]));
    const models = [...new Set([...requestModels, ...responses.flatMap(r => r.models), ...parameterModels])];
    return {
      key: op.key,
      method: op.method,
      path: op.path,
      name: op.summary || op.operationId || op.key,
      description: op.description,
      tag: op.tags[0] || 'Untagged',
      deprecated: op.deprecated,
      parameters: op.parameters.map(p => ({
        name: p.name,
        in: p.in,
        required: !!p.required || p.in === 'path',
        type: describeSchemaType(paramSchema(p)),
        description: p.description || '',
      })),
      requestBody: op.requestBody
        ? {
            contentType: op.requestBody.contentType,
            required: op.requestBody.required,
            type: describeSchemaType(op.requestBody.schema),
            models: requestModels,
          }
        : null,
      responses,
      models,
      reachable: reach(models),
    };
  });

  const models = modelNames.map(name => {
    const schema = normalized.models[name];
    const eff = effectiveSchema(doc, schema);
    return {
      name,
      type: describeSchemaType(schema),
      description: eff.description || '',
      enum: Array.isArray(eff.enum) ? eff.enum : undefined,
      fields: fieldList(doc, schema),
      refsOut: directRefs[name].filter(ref => ref !== name),
      usedBy: modelNames.filter(other => other !== name && directRefs[other].includes(name)),
      selfReferencing: directRefs[name].includes(name),
      endpoints: endpoints
        .filter(e => e.reachable.has(name))
        .map(e => ({ key: e.key, direct: e.models.includes(name) })),
    };
  });

  return {
    info: normalized.info,
    version: normalized.version.label,
    endpoints: endpoints.map(({ reachable, ...rest }) => rest),
    models,
  };
}

// ---------------------------------------------------------------------------
// Operation lookup for response validation
// ---------------------------------------------------------------------------

function pathTemplateToRegex(template) {
  const source = template
    .split(/(\{[^}]+\})/)
    .map(part => (/^\{[^}]+\}$/.test(part) ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${source}/?$`);
}

export function findOperation(normalized, method, path) {
  const upper = String(method || '').toUpperCase();
  return normalized.operations.find(op => op.method === upper && op.path === path)
    || normalized.operations.find(op => op.method === upper && pathTemplateToRegex(op.path).test(path));
}

export function findResponseSchema(op, status) {
  const code = String(status);
  for (const key of [code, `${code[0]}XX`, `${code[0]}xx`, 'default']) {
    if (op.responses[key]) return { status: key, response: op.responses[key] };
  }
  return null;
}

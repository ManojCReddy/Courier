import { CourierRequest } from '../types';
import { resolveInterpolation } from './environmentScoping';

export type SnippetLanguage = 'curl' | 'javascript-fetch' | 'javascript-axios' | 'python-requests';

export interface SnippetOption {
  id: SnippetLanguage;
  label: string;
  syntax: string;
}

export const SNIPPET_OPTIONS: SnippetOption[] = [
  { id: 'curl', label: 'cURL', syntax: 'bash' },
  { id: 'javascript-fetch', label: 'JavaScript - Fetch', syntax: 'javascript' },
  { id: 'javascript-axios', label: 'JavaScript - Axios', syntax: 'javascript' },
  { id: 'python-requests', label: 'Python - Requests', syntax: 'python' },
];

/**
 * Resolves request URL by substituting path parameters, interpolation tags, and query params.
 */
export function buildResolvedUrl(
  request: CourierRequest,
  variables: Record<string, string> = {}
): string {
  let url = request.url || '';

  // 1. Substitute Path Parameters (:id or {id})
  if (request.pathParams && request.pathParams.length > 0) {
    for (const p of request.pathParams) {
      if (p.enabled && p.key) {
        const cleanKey = p.key.replace(/^[:{}]*/, '').replace(/[}]*$/, '');
        const val = resolveInterpolation(p.value || '', variables);
        url = url.replace(new RegExp(`:${cleanKey}\\b`, 'g'), val);
        url = url.replace(new RegExp(`\\{${cleanKey}\\}`, 'g'), val);
      }
    }
  }

  // 2. Interpolate environment variables in URL
  url = resolveInterpolation(url, variables);

  // 3. Append enabled Query Params
  const queryParts: string[] = [];
  if (request.params && request.params.length > 0) {
    for (const p of request.params) {
      if (p.enabled && p.key) {
        const k = resolveInterpolation(p.key, variables);
        const v = resolveInterpolation(p.value || '', variables);
        queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
      }
    }
  }

  // 4. API Key placed in query
  if (
    request.auth &&
    request.auth.type === 'apiKey' &&
    request.auth.apiKeyPlacement === 'query' &&
    request.auth.apiKeyName &&
    request.auth.apiKeyValue
  ) {
    const k = resolveInterpolation(request.auth.apiKeyName, variables);
    const v = resolveInterpolation(request.auth.apiKeyValue, variables);
    queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }

  if (queryParts.length > 0) {
    const queryString = queryParts.join('&');
    url += (url.includes('?') ? '&' : '?') + queryString;
  }

  return url;
}

/**
 * Builds the resolved headers dictionary for the request.
 */
export function buildResolvedHeaders(
  request: CourierRequest,
  variables: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Custom Headers
  if (request.headers && request.headers.length > 0) {
    for (const h of request.headers) {
      if (h.enabled && h.key) {
        const k = resolveInterpolation(h.key, variables);
        const v = resolveInterpolation(h.value || '', variables);
        headers[k] = v;
      }
    }
  }

  // Auth Headers
  if (request.auth) {
    if (request.auth.type === 'bearer' && request.auth.bearerToken) {
      const token = resolveInterpolation(request.auth.bearerToken, variables);
      headers['Authorization'] = `Bearer ${token}`;
    } else if (request.auth.type === 'basic') {
      const u = resolveInterpolation(request.auth.basicUsername || '', variables);
      const p = resolveInterpolation(request.auth.basicPassword || '', variables);
      const b64 = typeof btoa !== 'undefined' ? btoa(`${u}:${p}`) : Buffer.from(`${u}:${p}`).toString('base64');
      headers['Authorization'] = `Basic ${b64}`;
    } else if (
      request.auth.type === 'apiKey' &&
      request.auth.apiKeyPlacement === 'header' &&
      request.auth.apiKeyName &&
      request.auth.apiKeyValue
    ) {
      const k = resolveInterpolation(request.auth.apiKeyName, variables);
      const v = resolveInterpolation(request.auth.apiKeyValue, variables);
      headers[k] = v;
    }
  }

  // Automatic Content-Type
  const hasContentType = Object.keys(headers).some(k => k.toLowerCase() === 'content-type');
  if (!hasContentType) {
    if (request.bodyType === 'json' && request.body) {
      headers['Content-Type'] = 'application/json';
    } else if (request.bodyType === 'urlencoded') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  return headers;
}

/**
 * Builds the resolved request body.
 */
export function buildResolvedBody(
  request: CourierRequest,
  variables: Record<string, string> = {}
): string | undefined {
  if (request.bodyType === 'none' || !request.body) {
    return undefined;
  }

  if (request.bodyType === 'json') {
    const interpolated = resolveInterpolation(request.body, variables);
    try {
      const parsed = JSON.parse(interpolated);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return interpolated;
    }
  }

  if (request.bodyType === 'raw') {
    return resolveInterpolation(request.body, variables);
  }

  if (request.bodyType === 'urlencoded') {
    if (Array.isArray(request.body)) {
      const formParams = new URLSearchParams();
      for (const item of request.body as any[]) {
        if (item.enabled && item.key) {
          formParams.append(
            resolveInterpolation(item.key, variables),
            resolveInterpolation(item.value || '', variables)
          );
        }
      }
      return formParams.toString();
    }
    return resolveInterpolation(String(request.body), variables);
  }

  return undefined;
}

/**
 * Generates Postman-style cURL command snippet.
 */
export function generateCurlSnippet(
  request: CourierRequest,
  variables: Record<string, string> = {}
): string {
  const url = buildResolvedUrl(request, variables);
  const headers = buildResolvedHeaders(request, variables);
  const body = buildResolvedBody(request, variables);
  const method = (request.method || 'GET').toUpperCase();

  const lines: string[] = [];

  // Start with curl --location
  if (method === 'GET' && !body) {
    lines.push(`curl --location '${url}'`);
  } else if (method === 'POST' && body) {
    lines.push(`curl --location '${url}'`);
  } else {
    lines.push(`curl --location --request ${method} '${url}'`);
  }

  // Headers
  for (const [k, v] of Object.entries(headers)) {
    lines.push(`--header '${k}: ${v.replace(/'/g, "'\\''")}'`);
  }

  // Body
  if (body !== undefined && body !== null && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (request.bodyType === 'urlencoded' && Array.isArray(request.body)) {
      for (const item of request.body as any[]) {
        if (item.enabled && item.key) {
          const k = resolveInterpolation(item.key, variables);
          const val = resolveInterpolation(item.value || '', variables);
          lines.push(`--data-urlencode '${k}=${val.replace(/'/g, "'\\''")}'`);
        }
      }
    } else {
      lines.push(`--data '${body.replace(/'/g, "'\\''")}'`);
    }
  }

  // Join lines with backslash continuations
  if (lines.length === 1) {
    return lines[0];
  }

  return lines.map((line, idx) => {
    if (idx === lines.length - 1) return line;
    return `${line} \\`;
  }).join('\n');
}

/**
 * Generates JavaScript Fetch snippet.
 */
export function generateFetchSnippet(
  request: CourierRequest,
  variables: Record<string, string> = {}
): string {
  const url = buildResolvedUrl(request, variables);
  const headers = buildResolvedHeaders(request, variables);
  const body = buildResolvedBody(request, variables);
  const method = (request.method || 'GET').toUpperCase();

  const codeLines: string[] = [];
  const headerKeys = Object.keys(headers);

  if (headerKeys.length > 0) {
    codeLines.push('const myHeaders = new Headers();');
    headerKeys.forEach(k => {
      codeLines.push(`myHeaders.append(${JSON.stringify(k)}, ${JSON.stringify(headers[k])});`);
    });
    codeLines.push('');
  }

  if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    codeLines.push(`const raw = ${JSON.stringify(body, null, 2)};`);
    codeLines.push('');
  }

  codeLines.push('const requestOptions = {');
  codeLines.push(`  method: ${JSON.stringify(method)},`);
  if (headerKeys.length > 0) {
    codeLines.push('  headers: myHeaders,');
  }
  if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    codeLines.push('  body: raw,');
  }
  codeLines.push('  redirect: "follow"');
  codeLines.push('};');
  codeLines.push('');

  codeLines.push(`fetch(${JSON.stringify(url)}, requestOptions)`);
  codeLines.push('  .then((response) => response.text())');
  codeLines.push('  .then((result) => console.log(result))');
  codeLines.push('  .catch((error) => console.error(error));');

  return codeLines.join('\n');
}

/**
 * Generates JavaScript Axios snippet.
 */
export function generateAxiosSnippet(
  request: CourierRequest,
  variables: Record<string, string> = {}
): string {
  const url = buildResolvedUrl(request, variables);
  const headers = buildResolvedHeaders(request, variables);
  const body = buildResolvedBody(request, variables);
  const method = (request.method || 'GET').toLowerCase();

  const codeLines: string[] = [
    "const axios = require('axios');",
  ];

  if (body && ['post', 'put', 'patch', 'delete'].includes(method)) {
    codeLines.push(`let data = ${JSON.stringify(body, null, 2)};`);
    codeLines.push('');
  }

  codeLines.push('let config = {');
  codeLines.push(`  method: '${method}',`);
  codeLines.push('  maxBodyLength: Infinity,');
  codeLines.push(`  url: ${JSON.stringify(url)},`);
  codeLines.push('  headers: {');
  Object.entries(headers).forEach(([k, v], idx, arr) => {
    codeLines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(v)}${idx === arr.length - 1 ? '' : ','}`);
  });
  codeLines.push('  }' + (body ? ',' : ''));
  if (body && ['post', 'put', 'patch', 'delete'].includes(method)) {
    codeLines.push('  data: data');
  }
  codeLines.push('};');
  codeLines.push('');
  codeLines.push('axios.request(config)');
  codeLines.push('.then((response) => {');
  codeLines.push('  console.log(JSON.stringify(response.data));');
  codeLines.push('})');
  codeLines.push('.catch((error) => {');
  codeLines.push('  console.error(error);');
  codeLines.push('});');

  return codeLines.join('\n');
}

/**
 * Generates Python Requests snippet.
 */
export function generatePythonSnippet(
  request: CourierRequest,
  variables: Record<string, string> = {}
): string {
  const url = buildResolvedUrl(request, variables);
  const headers = buildResolvedHeaders(request, variables);
  const body = buildResolvedBody(request, variables);
  const method = (request.method || 'GET').toUpperCase();

  const codeLines: string[] = [
    'import requests',
  ];

  if (body && request.bodyType === 'json') {
    codeLines.push('import json');
  }

  codeLines.push('');
  codeLines.push(`url = "${url.replace(/"/g, '\\"')}"`);
  codeLines.push('');

  if (body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    codeLines.push(`payload = """${body.replace(/"""/g, '\\"\\"\\"')}"""`);
  } else {
    codeLines.push('payload = {}');
  }

  codeLines.push('headers = {');
  Object.entries(headers).forEach(([k, v], idx, arr) => {
    codeLines.push(`  '${k}': '${v.replace(/'/g, "\\'")}'${idx === arr.length - 1 ? '' : ','}`);
  });
  codeLines.push('}');
  codeLines.push('');
  codeLines.push(`response = requests.request("${method}", url, headers=headers, data=payload)`);
  codeLines.push('');
  codeLines.push('print(response.text)');

  return codeLines.join('\n');
}

/**
 * Main snippet generator dispatcher.
 */
export function generateCodeSnippet(
  language: SnippetLanguage,
  request: CourierRequest,
  variables: Record<string, string> = {}
): string {
  switch (language) {
    case 'curl':
      return generateCurlSnippet(request, variables);
    case 'javascript-fetch':
      return generateFetchSnippet(request, variables);
    case 'javascript-axios':
      return generateAxiosSnippet(request, variables);
    case 'python-requests':
      return generatePythonSnippet(request, variables);
    default:
      return generateCurlSnippet(request, variables);
  }
}

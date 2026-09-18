import https from 'https';
import axios from 'axios';
import { resolveDeep, resolveVariables } from './variableResolver.js';
import { runAssertions } from './assertionEngine.js';

/**
 * Executes an HTTP request with environment variables, path params, SSL toggle, and timings
 */
export async function executeHttpRequest(requestConfig, environment = {}, settings = {}) {
  const {
    method = 'GET',
    url = '',
    params = [],
    pathParams = [],
    headers = [],
    body = '',
    bodyType = 'none',
    auth = { type: 'none' },
    assertions = [],
  } = requestConfig;

  if (!url || !url.trim()) {
    throw new Error('URL cannot be empty');
  }

  // 1. Resolve Path Variables / URI params (e.g. :id or {id})
  let resolvedUrl = url.trim();
  if (Array.isArray(pathParams)) {
    for (const p of pathParams) {
      if (p.enabled && p.key && p.key.trim()) {
        const k = p.key.trim().replace(/^[:{}]*/, '').replace(/[}]*$/, '');
        const v = resolveVariables(p.value || '', environment);
        
        // Match :param and {param}
        const colonRegex = new RegExp(`:${k}\\b`, 'g');
        const braceRegex = new RegExp(`\\{${k}\\}`, 'g');
        resolvedUrl = resolvedUrl.replace(colonRegex, v).replace(braceRegex, v);
      }
    }
  }

  // 2. Resolve Environment & Dynamic Variables in URL
  resolvedUrl = resolveVariables(resolvedUrl, environment);
  if (!/^https?:\/\//i.test(resolvedUrl)) {
    resolvedUrl = 'https://' + resolvedUrl;
  }

  // 3. Resolve & Build Query Params
  const queryParams = {};
  if (Array.isArray(params)) {
    for (const p of params) {
      if (p.enabled && p.key && p.key.trim()) {
        const k = resolveVariables(p.key.trim(), environment);
        const v = resolveVariables(p.value || '', environment);
        queryParams[k] = v;
      }
    }
  }

  // 4. Resolve & Build Headers
  const resolvedHeaders = {};
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h.enabled && h.key && h.key.trim()) {
        const k = resolveVariables(h.key.trim(), environment);
        const v = resolveVariables(h.value || '', environment);
        resolvedHeaders[k] = v;
      }
    }
  }

  // 5. Handle Authentication
  if (auth && auth.type) {
    if (auth.type === 'bearer' && auth.bearerToken) {
      const token = resolveVariables(auth.bearerToken, environment);
      resolvedHeaders['Authorization'] = `Bearer ${token}`;
    } else if (auth.type === 'basic') {
      const u = resolveVariables(auth.basicUsername || '', environment);
      const p = resolveVariables(auth.basicPassword || '', environment);
      const encoded = Buffer.from(`${u}:${p}`).toString('base64');
      resolvedHeaders['Authorization'] = `Basic ${encoded}`;
    } else if (auth.type === 'apiKey' && auth.apiKeyName) {
      const keyName = resolveVariables(auth.apiKeyName, environment);
      const keyValue = resolveVariables(auth.apiKeyValue || '', environment);
      if (auth.apiKeyPlacement === 'query') {
        queryParams[keyName] = keyValue;
      } else {
        resolvedHeaders[keyName] = keyValue;
      }
    }
  }

  // 6. Build & Resolve Body
  let resolvedData = undefined;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    if (bodyType === 'json' && body) {
      const substitutedBody = resolveVariables(body, environment);
      try {
        resolvedData = JSON.parse(substitutedBody);
        if (!resolvedHeaders['Content-Type']) {
          resolvedHeaders['Content-Type'] = 'application/json';
        }
      } catch {
        resolvedData = substitutedBody;
        if (!resolvedHeaders['Content-Type']) {
          resolvedHeaders['Content-Type'] = 'application/json';
        }
      }
    } else if (bodyType === 'raw' && body) {
      resolvedData = resolveVariables(body, environment);
    } else if (bodyType === 'urlencoded' && Array.isArray(body)) {
      const formParams = new URLSearchParams();
      for (const item of body) {
        if (item.enabled && item.key) {
          formParams.append(
            resolveVariables(item.key, environment),
            resolveVariables(item.value || '', environment)
          );
        }
      }
      resolvedData = formParams.toString();
      resolvedHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }
  }

  // cURL string representation
  const curlCmd = buildCurlString({
    method,
    url: resolvedUrl,
    params: queryParams,
    headers: resolvedHeaders,
    data: resolvedData,
  });

  // 7. HTTPS Agent (SSL Certificate Verification Setting)
  const disableSsl = settings.disableSslVerification ?? false;
  const httpsAgent = new https.Agent({
    rejectUnauthorized: !disableSsl,
  });

  const timeoutMs = parseInt(settings.defaultTimeoutMs || '30000', 10);

  // 8. Execute Request & Measure Latency
  const startTime = performance.now();
  try {
    const response = await axios({
      method,
      url: resolvedUrl,
      params: queryParams,
      headers: resolvedHeaders,
      data: resolvedData,
      httpsAgent,
      validateStatus: () => true, // capture all status codes
      timeout: timeoutMs,
      transformResponse: [(data) => {
        try {
          return JSON.parse(data);
        } catch {
          return data;
        }
      }],
    });

    const endTime = performance.now();
    const timeMs = Math.round(endTime - startTime);

    let sizeBytes = 0;
    if (response.data) {
      const dataStr = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
      sizeBytes = Buffer.byteLength(dataStr, 'utf8');
    }

    const testResults = runAssertions(assertions, {
      status: response.status,
      timeMs,
      data: response.data,
      headers: response.headers,
    });

    return {
      status: response.status,
      statusText: response.statusText || getStatusText(response.status),
      headers: response.headers,
      data: response.data,
      timeMs,
      sizeBytes,
      curlCommand: curlCmd,
      testResults,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const endTime = performance.now();
    const timeMs = Math.round(endTime - startTime);

    return {
      status: 0,
      statusText: error.code || 'Network Error',
      headers: {},
      data: { error: error.message, code: error.code },
      timeMs,
      sizeBytes: 0,
      curlCommand: curlCmd,
      testResults: runAssertions(assertions, { status: 0, timeMs, data: error.message, headers: {} }),
      timestamp: new Date().toISOString(),
    };
  }
}

function buildCurlString({ method, url, params, headers, data }) {
  let cmd = `curl -X ${method.toUpperCase()} "${url}`;
  
  const paramKeys = Object.keys(params || {});
  if (paramKeys.length > 0) {
    const qs = new URLSearchParams(params).toString();
    cmd += (url.includes('?') ? '&' : '?') + qs;
  }
  cmd += `"`;

  for (const [k, v] of Object.entries(headers || {})) {
    cmd += ` \\\n  -H "${k}: ${v}"`;
  }

  if (data !== undefined && data !== null) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    cmd += ` \\\n  -d '${dataStr.replace(/'/g, "'\\''")}'`;
  }

  return cmd;
}

function getStatusText(code) {
  const map = {
    200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests',
    500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable',
  };
  return map[code] || 'Unknown';
}

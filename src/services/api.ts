import { CourierCollection, Environment, HttpResponse, CourierRequest, CopilotConfig, AppSettings, OpenApiPreview, SpecSummary, ApiMap, ContractResult } from '../types';

const BASE_URL = '/api';

export async function fetchCollections(): Promise<CourierCollection[]> {
  const res = await fetch(`${BASE_URL}/collections`);
  if (!res.ok) throw new Error('Failed to fetch collections');
  return res.json();
}

export async function saveCollection(collection: CourierCollection): Promise<CourierCollection> {
  const res = await fetch(`${BASE_URL}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collection),
  });
  if (!res.ok) throw new Error('Failed to save collection');
  return res.json();
}

export async function deleteCollection(id: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/collections/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete collection');
  const data = await res.json();
  return data.success;
}

export async function fetchEnvironments(): Promise<Environment[]> {
  const res = await fetch(`${BASE_URL}/environments`);
  if (!res.ok) throw new Error('Failed to fetch environments');
  return res.json();
}

export async function saveEnvironment(environment: Environment): Promise<Environment> {
  const res = await fetch(`${BASE_URL}/environments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(environment),
  });
  if (!res.ok) throw new Error('Failed to save environment');
  return res.json();
}

export async function deleteEnvironment(id: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/environments/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete environment');
  const data = await res.json();
  return data.success;
}

export async function executeRequest(
  requestConfig: CourierRequest,
  environmentVariables: Record<string, string>,
  settings?: Partial<AppSettings>
): Promise<HttpResponse> {
  const res = await fetch(`${BASE_URL}/http/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestConfig,
      environment: environmentVariables,
      settings: settings || {},
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to execute request');
  }
  return res.json();
}

export async function parseCurlCommand(curl: string): Promise<Partial<CourierRequest>> {
  const res = await fetch(`${BASE_URL}/curl/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ curl }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to parse cURL');
  }
  return res.json();
}

async function postJson<T>(url: string, payload: unknown, fallback: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || fallback);
  }
  return res.json();
}

export function previewOpenApi(content: string): Promise<OpenApiPreview> {
  return postJson(`${BASE_URL}/openapi/preview`, { content }, 'Failed to read the specification');
}

export function importOpenApi(payload: {
  content: string;
  filename?: string;
  name?: string;
  baseUrl?: string;
}): Promise<{ collection: CourierCollection; summary: OpenApiPreview }> {
  return postJson(`${BASE_URL}/openapi/import`, payload, 'Failed to import the specification');
}

export async function fetchSpecs(): Promise<SpecSummary[]> {
  const res = await fetch(`${BASE_URL}/specs`);
  if (!res.ok) throw new Error('Failed to fetch specifications');
  return res.json();
}

export async function fetchApiMap(specId: string): Promise<ApiMap> {
  const res = await fetch(`${BASE_URL}/specs/${encodeURIComponent(specId)}/map`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load the API map');
  }
  return res.json();
}

export function checkContract(
  specId: string,
  payload: { method: string; path: string; status: number; data: unknown }
): Promise<ContractResult> {
  return postJson(`${BASE_URL}/specs/${encodeURIComponent(specId)}/contract`, payload, 'Failed to check the response contract');
}

export async function callCopilot(params: {
  messages: Array<{ role: string; content: string }>;
  mode: string;
  context: {
    currentRequest?: CourierRequest;
    currentResponse?: HttpResponse | null;
  };
  config: CopilotConfig;
}): Promise<{
  reply: string;
  providerUsed: string;
  isLocal: boolean;
  suggestions?: any;
}> {
  const res = await fetch(`${BASE_URL}/copilot/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to call Copilot');
  }
  return res.json();
}


export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apiKey';

export interface AuthConfig {
  type: AuthType;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  apiKeyName?: string;
  apiKeyValue?: string;
  apiKeyPlacement?: 'header' | 'query';
}

export type BodyType = 'none' | 'json' | 'xml' | 'raw' | 'urlencoded' | 'formdata' | 'binary';
export type RawBodyFormat = 'text' | 'javascript' | 'json' | 'html' | 'xml';
export type BodyDraftKey = Exclude<BodyType, 'raw' | 'xml'> | `raw:${RawBodyFormat}`;

export type AssertionType =
  | 'STATUS_CODE_EQUALS'
  | 'STATUS_IS_2XX'
  | 'RESPONSE_TIME_LESS_THAN'
  | 'BODY_CONTAINS'
  | 'JSON_PROPERTY_EXISTS'
  | 'JSON_PROPERTY_EQUALS';

export interface TestAssertion {
  id: string;
  name: string;
  type: AssertionType;
  expected: string;
  target?: string;
  enabled: boolean;
}

export interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  actual?: any;
  expected?: any;
}

export interface CourierRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValuePair[];
  pathParams?: KeyValuePair[];
  headers: KeyValuePair[];
  auth: AuthConfig;
  bodyType: BodyType;
  rawFormat?: RawBodyFormat;
  body: string;
  bodyDrafts?: Partial<Record<BodyDraftKey, string>>;
  assertions: TestAssertion[];
  /** Optional post-response script (JS). Runs after every successful send. */
  script?: string;
  /** Links a request generated from an imported OpenAPI/Swagger spec to its operation. */
  openapi?: { specId: string; method: string; path: string };
}

export interface CourierFolder {
  id: string;
  name: string;
  requests: CourierRequest[];
  folders?: CourierFolder[];
  variables?: KeyValuePair[];
}

export interface CourierCollection {
  id: string;
  name: string;
  description?: string;
  requests: CourierRequest[];
  folders?: CourierFolder[];
  variables?: KeyValuePair[];
}

export interface AppSettings {
  disableSslVerification: boolean;
  autoSave: boolean;
  defaultTimeoutMs: number;
  layout: 'horizontal' | 'vertical';
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
  isSecret?: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  timeMs: number;
  sizeBytes: number;
  curlCommand: string;
  testResults?: TestResult[];
  timestamp: string;
  scriptLogs?: Array<{ level: 'info' | 'warn' | 'error' | 'pass' | 'fail'; message: string }>;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: {
    request?: Partial<CourierRequest>;
    assertions?: TestAssertion[];
  } | null;
  providerUsed?: string;
}

export interface CopilotConfig {
  provider: 'auto' | 'local_ollama' | 'gemini' | 'openai';
  ollamaUrl: string;
  ollamaModel: string;
  geminiKey: string;
  geminiModel: string;
  openaiKey: string;
  openaiModel: string;
}


export interface OpenApiPreview {
  version: string;
  info: { title: string; version: string; description: string };
  servers: Array<{ url: string; description?: string }>;
  security: Array<{ name: string; kind: string; in?: string; paramName?: string }>;
  counts: { endpoints: number; models: number; folders: number; methods: Record<string, number> };
  folders: Array<{ name: string; count: number }>;
  endpoints: Array<{ method: string; path: string; name: string; tag: string; hasBody: boolean; deprecated: boolean }>;
  warnings: string[];
}

export interface SpecSummary {
  id: string;
  name: string;
  version: string;
  importedAt: string;
  source: string | null;
}

export interface MapEndpoint {
  key: string;
  method: string;
  path: string;
  name: string;
  description: string;
  tag: string;
  deprecated: boolean;
  parameters: Array<{ name: string; in: string; required: boolean; type: string; description: string }>;
  requestBody: { contentType: string; required: boolean; type: string; models: string[] } | null;
  responses: Array<{ status: string; description: string; contentType: string | null; type: string | null; models: string[] }>;
  models: string[];
}

export interface MapModel {
  name: string;
  type: string;
  description: string;
  enum?: unknown[];
  fields: Array<{ name: string; type: string; required: boolean; nullable: boolean; description: string; refs: string[] }>;
  refsOut: string[];
  usedBy: string[];
  selfReferencing: boolean;
  endpoints: Array<{ key: string; direct: boolean }>;
}

export interface ApiMap {
  id: string;
  name: string;
  version: string;
  info: { title: string; version: string; description: string };
  endpoints: MapEndpoint[];
  models: MapModel[];
}

export interface ContractMismatch {
  path: string;
  message: string;
  expected?: string;
  actual?: string;
}

export interface ContractResult {
  matched: boolean;
  reason?: string;
  operation?: string;
  status?: number;
  matchedStatus?: string;
  hasSchema?: boolean;
  expectedType?: string;
  validation: { valid: boolean; errors: ContractMismatch[] } | null;
  drift: {
    added: Array<{ path: string; observed: string; occurrences: number }>;
    missing: Array<{ path: string; required: boolean; absentIn: number; of: number }>;
    typeChanged: Array<{ path: string; expected: string; observed: string }>;
    summary: { added: number; missing: number; typeChanged: number; total: number };
  } | null;
}

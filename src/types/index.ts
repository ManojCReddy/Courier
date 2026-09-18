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

export type BodyType = 'none' | 'json' | 'raw' | 'urlencoded';

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
  headers: KeyValuePair[];
  auth: AuthConfig;
  bodyType: BodyType;
  body: string;
  assertions: TestAssertion[];
}

export interface CourierCollection {
  id: string;
  name: string;
  description?: string;
  requests: CourierRequest[];
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


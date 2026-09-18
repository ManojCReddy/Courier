import React, { useState } from 'react';
import {
  Send,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Wand2,
  Shield,
  KeyRound,
  FileText,
  SlidersHorizontal,
  FlaskConical,
  Sparkles
} from 'lucide-react';
import { CourierRequest, HttpMethod, AuthType, BodyType, TestAssertion } from '../types';

interface RequestPanelProps {
  request: CourierRequest;
  isLoading: boolean;
  onUpdateRequest: (updated: CourierRequest) => void;
  onSendRequest: () => void;
  onSaveRequest: () => void;
  onOpenCopilotWithPrompt?: (prompt: string) => void;
}

export const RequestPanel: React.FC<RequestPanelProps> = ({
  request,
  isLoading,
  onUpdateRequest,
  onSendRequest,
  onSaveRequest,
  onOpenCopilotWithPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'auth' | 'body' | 'tests'>('params');

  const updateField = <K extends keyof CourierRequest>(key: K, value: CourierRequest[K]) => {
    onUpdateRequest({ ...request, [key]: value });
  };

  // URL & Method
  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateField('method', e.target.value as HttpMethod);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    
    // Auto-detect URI/Path parameters like :id or {id}
    const colonMatches = Array.from(newUrl.matchAll(/:([a-zA-Z0-9_]+)/g)).map(m => m[1]);
    const braceMatches = Array.from(newUrl.matchAll(/\{([a-zA-Z0-9_]+)\}/g)).map(m => m[1]);
    const detectedKeys = Array.from(new Set([...colonMatches, ...braceMatches]));

    let currentPathParams = request.pathParams || [];
    let updatedPathParams = [...currentPathParams];

    detectedKeys.forEach(k => {
      if (!updatedPathParams.some(p => p.key === k)) {
        updatedPathParams.push({ key: k, value: '', enabled: true });
      }
    });

    onUpdateRequest({ ...request, url: newUrl, pathParams: updatedPathParams });
  };

  // Query Params
  const addParam = () => {
    const params = [...request.params, { key: '', value: '', enabled: true }];
    updateField('params', params);
  };

  const updateParam = (idx: number, patch: Partial<(typeof request.params)[0]>) => {
    const params = [...request.params];
    params[idx] = { ...params[idx], ...patch };
    updateField('params', params);
  };

  const removeParam = (idx: number) => {
    const params = request.params.filter((_, i) => i !== idx);
    updateField('params', params);
  };

  // Path / URI Params
  const addPathParam = () => {
    const pParams = [...(request.pathParams || []), { key: '', value: '', enabled: true }];
    updateField('pathParams', pParams);
  };

  const updatePathParam = (idx: number, patch: Partial<KeyValuePair>) => {
    const pParams = [...(request.pathParams || [])];
    pParams[idx] = { ...pParams[idx], ...patch };
    updateField('pathParams', pParams);
  };

  const removePathParam = (idx: number) => {
    const pParams = (request.pathParams || []).filter((_, i) => i !== idx);
    updateField('pathParams', pParams);
  };

  // Headers
  const addHeader = () => {
    const headers = [...request.headers, { key: '', value: '', enabled: true }];
    updateField('headers', headers);
  };

  const updateHeader = (idx: number, patch: Partial<(typeof request.headers)[0]>) => {
    const headers = [...request.headers];
    headers[idx] = { ...headers[idx], ...patch };
    updateField('headers', headers);
  };

  const removeHeader = (idx: number) => {
    const headers = request.headers.filter((_, i) => i !== idx);
    updateField('headers', headers);
  };

  // Auth
  const handleAuthTypeChange = (type: AuthType) => {
    updateField('auth', { ...request.auth, type });
  };

  // Body
  const handleBodyTypeChange = (bodyType: BodyType) => {
    updateField('bodyType', bodyType);
  };

  const formatJsonBody = () => {
    try {
      const parsed = JSON.parse(request.body);
      updateField('body', JSON.stringify(parsed, null, 2));
    } catch {
      alert('Invalid JSON: Unable to format');
    }
  };

  // Tests / Assertions
  const addAssertion = (type: TestAssertion['type'] = 'STATUS_CODE_EQUALS', expected = '200') => {
    const newAssertion: TestAssertion = {
      id: `a-${Date.now()}`,
      name: type === 'STATUS_CODE_EQUALS' ? 'Status code is 200' : 'New Assertion',
      type,
      expected,
      enabled: true,
    };
    updateField('assertions', [...request.assertions, newAssertion]);
  };

  const updateAssertion = (idx: number, patch: Partial<TestAssertion>) => {
    const assertions = [...request.assertions];
    assertions[idx] = { ...assertions[idx], ...patch };
    updateField('assertions', assertions);
  };

  const removeAssertion = (idx: number) => {
    const assertions = request.assertions.filter((_, i) => i !== idx);
    updateField('assertions', assertions);
  };

  return (
    <div className="flex flex-col h-full bg-[#141418] select-none">
      {/* Top Request Bar: Name, Save */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
        <input
          type="text"
          value={request.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Request Name"
          className="bg-transparent font-medium text-sm text-zinc-200 focus:outline-none border-b border-transparent focus:border-emerald-500 transition-colors w-1/3"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={onSaveRequest}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-colors"
            title="Save request changes to local file"
          >
            <Save className="w-3.5 h-3.5 text-zinc-400" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Main Address Bar */}
      <div className="p-4 pb-3 flex items-center gap-2">
        {/* Method Dropdown */}
        <select
          value={request.method}
          onChange={handleMethodChange}
          className="bg-zinc-900 border border-zinc-700 text-xs font-bold font-mono px-3 py-2 rounded-lg text-emerald-400 focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
          <option value="OPTIONS">OPTIONS</option>
          <option value="HEAD">HEAD</option>
        </select>

        {/* URL Input */}
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            value={request.url}
            onChange={handleUrlChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                onSendRequest();
              }
            }}
            placeholder="https://api.example.com/v1/resource or {{baseUrl}}/resource"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={onSendRequest}
          disabled={isLoading}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Send Request (Ctrl + Enter)"
        >
          {isLoading ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </>
          )}
        </button>
      </div>

      {/* Request Config Tabs */}
      <div className="flex items-center border-b border-zinc-800 px-4 gap-1 text-xs">
        <button
          onClick={() => setActiveTab('params')}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'params'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Params
          {request.params.filter(p => p.enabled && p.key).length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] text-zinc-300">
              {request.params.filter(p => p.enabled && p.key).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('headers')}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'headers'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Headers
          {request.headers.filter(h => h.enabled && h.key).length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] text-zinc-300">
              {request.headers.filter(h => h.enabled && h.key).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('auth')}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'auth'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Auth
          {request.auth?.type !== 'none' && (
            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('body')}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'body'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Body
          {request.bodyType !== 'none' && (
            <span className="ml-1.5 px-1 py-0.2 rounded bg-zinc-800 text-[10px] text-zinc-300 font-mono">
              {request.bodyType}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('tests')}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'tests'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Test Assertions
          {request.assertions?.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] text-emerald-400 font-mono">
              {request.assertions.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* PARAMS TAB: Both Path Variables (URI Params) and Query Parameters */}
        {activeTab === 'params' && (
          <div className="space-y-6">
            {/* 1. Path Variables / URI Parameters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-300 font-semibold flex items-center gap-1.5">
                    Path Variables (URI Params)
                    <span className="text-[10px] text-zinc-500 font-normal">e.g. /users/:id or /users/{'{id}'}</span>
                  </span>
                </div>
                <button
                  onClick={addPathParam}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Path Variable
                </button>
              </div>

              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="p-2 w-8 text-center"></th>
                      <th className="p-2 w-1/3">Parameter (e.g. id)</th>
                      <th className="p-2 w-1/2">Value</th>
                      <th className="p-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40 font-mono">
                    {(request.pathParams || []).map((p, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/40">
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={p.enabled}
                            onChange={(e) => updatePathParam(idx, { enabled: e.target.checked })}
                            className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={p.key}
                            onChange={(e) => updatePathParam(idx, { key: e.target.value })}
                            placeholder="paramName"
                            className="w-full bg-transparent text-zinc-200 focus:outline-none text-emerald-400 font-semibold"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={p.value}
                            onChange={(e) => updatePathParam(idx, { value: e.target.value })}
                            placeholder="value or {{var}}"
                            className="w-full bg-transparent text-zinc-200 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => removePathParam(idx)}
                            className="text-zinc-500 hover:text-rose-400 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!request.pathParams || request.pathParams.length === 0) && (
                      <tr>
                        <td colSpan={4} className="p-3 text-center text-zinc-500 italic">
                          No path variables detected. Use <code className="text-emerald-400">:id</code> or <code className="text-emerald-400">{'{id}'}</code> in the URL to automatically create path parameters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Query Parameters */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300 font-semibold">Query Parameters</span>
                <button
                  onClick={addParam}
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Param
                </button>
              </div>

              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                    <tr>
                      <th className="p-2 w-8 text-center"></th>
                      <th className="p-2 w-1/3">Key</th>
                      <th className="p-2 w-1/2">Value</th>
                      <th className="p-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40 font-mono">
                    {request.params.map((p, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/40">
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={p.enabled}
                            onChange={(e) => updateParam(idx, { enabled: e.target.checked })}
                            className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={p.key}
                            onChange={(e) => updateParam(idx, { key: e.target.value })}
                            placeholder="parameter"
                            className="w-full bg-transparent text-zinc-200 focus:outline-none"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={p.value}
                            onChange={(e) => updateParam(idx, { value: e.target.value })}
                            placeholder="value or {{var}}"
                            className="w-full bg-transparent text-zinc-200 focus:outline-none"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => removeParam(idx)}
                            className="text-zinc-500 hover:text-rose-400 p-1 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {request.params.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-3 text-center text-zinc-500 italic">
                          No query parameters. Click "+ Add Param" to add <code className="text-zinc-400">?key=value</code>.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400 font-medium">Headers</span>
              <button
                onClick={addHeader}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
              >
                <Plus className="w-3.5 h-3.5" /> Add Header
              </button>
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="p-2 w-8 text-center"></th>
                    <th className="p-2 w-1/3">Header</th>
                    <th className="p-2 w-1/2">Value</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                  {request.headers.map((h, idx) => (
                    <tr key={idx} className="hover:bg-zinc-900/40">
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={(e) => updateHeader(idx, { enabled: e.target.checked })}
                          className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={h.key}
                          onChange={(e) => updateHeader(idx, { key: e.target.value })}
                          placeholder="Content-Type"
                          className="w-full bg-transparent text-zinc-200 focus:outline-none font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={h.value}
                          onChange={(e) => updateHeader(idx, { value: e.target.value })}
                          placeholder="application/json or {{token}}"
                          className="w-full bg-transparent text-zinc-200 focus:outline-none font-mono"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => removeHeader(idx)}
                          className="text-zinc-500 hover:text-rose-400 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {request.headers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-zinc-500 italic">
                        No custom headers configured. Click "+ Add Header" to add.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUTH TAB */}
        {activeTab === 'auth' && (
          <div className="max-w-xl space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-xs text-zinc-400 font-medium">Type:</label>
              <select
                value={request.auth?.type || 'none'}
                onChange={(e) => handleAuthTypeChange(e.target.value as AuthType)}
                className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="apiKey">API Key</option>
              </select>
            </div>

            {request.auth?.type === 'bearer' && (
              <div className="space-y-1.5 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                <label className="text-xs text-zinc-300 font-medium flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                  Bearer Token:
                </label>
                <input
                  type="text"
                  value={request.auth.bearerToken || ''}
                  onChange={(e) => updateField('auth', { ...request.auth, bearerToken: e.target.value })}
                  placeholder="token or {{authToken}}"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {request.auth?.type === 'basic' && (
              <div className="grid grid-cols-2 gap-3 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-300 font-medium">Username:</label>
                  <input
                    type="text"
                    value={request.auth.basicUsername || ''}
                    onChange={(e) => updateField('auth', { ...request.auth, basicUsername: e.target.value })}
                    placeholder="user or {{username}}"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-300 font-medium">Password:</label>
                  <input
                    type="password"
                    value={request.auth.basicPassword || ''}
                    onChange={(e) => updateField('auth', { ...request.auth, basicPassword: e.target.value })}
                    placeholder="password or {{password}}"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {request.auth?.type === 'apiKey' && (
              <div className="space-y-3 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-300 font-medium">Key Name:</label>
                    <input
                      type="text"
                      value={request.auth.apiKeyName || ''}
                      onChange={(e) => updateField('auth', { ...request.auth, apiKeyName: e.target.value })}
                      placeholder="X-API-Key"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-300 font-medium">Key Value:</label>
                    <input
                      type="text"
                      value={request.auth.apiKeyValue || ''}
                      onChange={(e) => updateField('auth', { ...request.auth, apiKeyValue: e.target.value })}
                      placeholder="value or {{apiKey}}"
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <span className="text-zinc-400">Add to:</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="apiPlacement"
                      checked={request.auth.apiKeyPlacement !== 'query'}
                      onChange={() => updateField('auth', { ...request.auth, apiKeyPlacement: 'header' })}
                    />
                    <span>Header</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="apiPlacement"
                      checked={request.auth.apiKeyPlacement === 'query'}
                      onChange={() => updateField('auth', { ...request.auth, apiKeyPlacement: 'query' })}
                    />
                    <span>Query Params</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* BODY TAB */}
        {activeTab === 'body' && (
          <div className="flex flex-col h-full space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs">
                {(['none', 'json', 'raw'] as BodyType[]).map((type) => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer text-zinc-300 capitalize">
                    <input
                      type="radio"
                      name="bodyType"
                      value={type}
                      checked={request.bodyType === type}
                      onChange={() => handleBodyTypeChange(type)}
                      className="text-emerald-500 focus:ring-0"
                    />
                    {type === 'none' ? 'No Body' : type.toUpperCase()}
                  </label>
                ))}
              </div>

              {request.bodyType === 'json' && (
                <button
                  onClick={formatJsonBody}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded transition-colors"
                  title="Beautify JSON formatting"
                >
                  <Wand2 className="w-3 h-3 text-emerald-400" />
                  Format JSON
                </button>
              )}
            </div>

            {request.bodyType !== 'none' && (
              <textarea
                value={request.body}
                onChange={(e) => updateField('body', e.target.value)}
                placeholder={request.bodyType === 'json' ? '{\n  "title": "My Post",\n  "userId": 1\n}' : 'Raw payload...'}
                className="w-full flex-1 min-h-[220px] bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none leading-relaxed"
                spellCheck={false}
              />
            )}
          </div>
        )}

        {/* TESTS TAB */}
        {activeTab === 'tests' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">Test Assertions</h4>
                <p className="text-[11px] text-zinc-500">Assertions run automatically every time you send this request.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => addAssertion('STATUS_CODE_EQUALS', '200')}
                  className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors"
                >
                  + Status 200
                </button>
                <button
                  onClick={() => addAssertion('RESPONSE_TIME_LESS_THAN', '500')}
                  className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors"
                >
                  + Time &lt; 500ms
                </button>
                <button
                  onClick={() => addAssertion('JSON_PROPERTY_EXISTS', '')}
                  className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors"
                >
                  + Property Exists
                </button>
              </div>
            </div>

            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                  <tr>
                    <th className="p-2 w-8 text-center"></th>
                    <th className="p-2 w-1/4">Name</th>
                    <th className="p-2 w-1/4">Assertion Type</th>
                    <th className="p-2 w-1/4">Target / Expected</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                  {request.assertions.map((a, idx) => (
                    <tr key={a.id || idx} className="hover:bg-zinc-900/40">
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={a.enabled}
                          onChange={(e) => updateAssertion(idx, { enabled: e.target.checked })}
                          className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={a.name}
                          onChange={(e) => updateAssertion(idx, { name: e.target.value })}
                          placeholder="Assertion Name"
                          className="w-full bg-transparent text-zinc-200 focus:outline-none"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={a.type}
                          onChange={(e) => updateAssertion(idx, { type: e.target.value as any })}
                          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                        >
                          <option value="STATUS_CODE_EQUALS">Status Code Equals</option>
                          <option value="STATUS_IS_2XX">Status is 2xx Success</option>
                          <option value="RESPONSE_TIME_LESS_THAN">Response Time Under (ms)</option>
                          <option value="BODY_CONTAINS">Body Contains Text</option>
                          <option value="JSON_PROPERTY_EXISTS">JSON Property Exists</option>
                          <option value="JSON_PROPERTY_EQUALS">JSON Property Equals</option>
                        </select>
                      </td>
                      <td className="p-2">
                        {a.type === 'JSON_PROPERTY_EXISTS' || a.type === 'JSON_PROPERTY_EQUALS' ? (
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={a.target || ''}
                              onChange={(e) => updateAssertion(idx, { target: e.target.value })}
                              placeholder="path (e.g. data.id)"
                              className="w-1/2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200"
                            />
                            {a.type === 'JSON_PROPERTY_EQUALS' && (
                              <input
                                type="text"
                                value={a.expected}
                                onChange={(e) => updateAssertion(idx, { expected: e.target.value })}
                                placeholder="expected"
                                className="w-1/2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200"
                              />
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={a.expected}
                            onChange={(e) => updateAssertion(idx, { expected: e.target.value })}
                            placeholder="200"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-200"
                          />
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => removeAssertion(idx)}
                          className="text-zinc-500 hover:text-rose-400 p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {request.assertions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-zinc-500 italic">
                        No test assertions added yet. Click one of the presets above or use Courier Copilot to auto-generate them!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


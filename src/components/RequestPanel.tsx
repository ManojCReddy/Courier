import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronFirst,
  ChevronLeft,
  ChevronRight,
  ChevronLast,
  Send,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Wand2,
  Shield,
  KeyRound,
  FileText,
  FlaskConical,
  Sparkles,
  Terminal,
  Code2
} from 'lucide-react';
import { CourierRequest, HttpMethod, AuthType, BodyType, BodyDraftKey, RawBodyFormat, TestAssertion, KeyValuePair } from '../types';
import { resolveInterpolation } from '../services/environmentScoping';

interface RequestPanelProps {
  request: CourierRequest;
  isLoading: boolean;
  environmentVariables: Record<string, string>;
  onUpdateEnvironmentVariable: (key: string, value: string) => Promise<void>;
  onUpdateRequest: (updatedRequest: CourierRequest) => void;
  onSendRequest: () => void;
  onSaveRequest: () => void;
  isCodeSnippetOpen?: boolean;
  onToggleCodeSnippet?: () => void;
}

export const RequestPanel: React.FC<RequestPanelProps> = ({
  request,
  isLoading,
  environmentVariables,
  onUpdateEnvironmentVariable,
  onUpdateRequest,
  onSendRequest,
  onSaveRequest,
  isCodeSnippetOpen,
  onToggleCodeSnippet,
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'auth' | 'body' | 'tests' | 'script'>('params');
  const [curlPreviewOpen, setCurlPreviewOpen] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [bodySearchOpen, setBodySearchOpen] = useState(false);
  const [bodySearch, setBodySearch] = useState('');
  const [bodyReplaceOpen, setBodyReplaceOpen] = useState(false);
  const [bodyReplace, setBodyReplace] = useState('');
  const [bodySearchIndex, setBodySearchIndex] = useState(0);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [hoveredVariable, setHoveredVariable] = useState<{ key: string; type: 'environment' | 'path' } | null>(null);
  const [variableDraft, setVariableDraft] = useState('');
  const variableCloseTimerRef = useRef<number | null>(null);
  const variableSaveTimerRef = useRef<number | null>(null);

  const openVariableEditor = (key: string, type: 'environment' | 'path') => {
    if (variableCloseTimerRef.current !== null) {
      window.clearTimeout(variableCloseTimerRef.current);
    }
    setHoveredVariable({ key, type });
    if (type === 'environment') {
      setVariableDraft(environmentVariables[key] || '');
    } else {
      const pathVariable = (request.pathParams || []).find(param => (
        param.key.replace(/^[:{}]*/, '').replace(/[}]*$/, '') === key
      ));
      setVariableDraft(pathVariable?.value || '');
    }
  };

  const scheduleVariableEditorClose = () => {
    variableCloseTimerRef.current = window.setTimeout(() => {
      setHoveredVariable(null);
    }, 180);
  };

  const persistVariableValue = async (
    variable: { key: string; type: 'environment' | 'path' },
    value: string
  ) => {
    if (variable.type === 'environment') {
      await onUpdateEnvironmentVariable(variable.key, value);
    } else {
      const pathParams = [...(request.pathParams || [])];
      const pathIndex = pathParams.findIndex(param => (
        param.key.replace(/^[:{}]*/, '').replace(/[}]*$/, '') === variable.key
      ));
      if (pathIndex >= 0) {
        pathParams[pathIndex] = { ...pathParams[pathIndex], value, enabled: true };
      } else {
        pathParams.push({ key: variable.key, value, enabled: true });
      }
      updateField('pathParams', pathParams);
    }
  };

  const saveVariableDraft = async () => {
    if (!hoveredVariable) return;
    await persistVariableValue(hoveredVariable, variableDraft);
    setHoveredVariable(null);
  };

  const getBodyMatchStarts = (query: string) => {
    if (!query) return [];
    const starts: number[] = [];
    const body = request.body.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    let cursor = 0;
    while ((cursor = body.indexOf(normalizedQuery, cursor)) >= 0) {
      starts.push(cursor);
      cursor += normalizedQuery.length;
    }
    return starts;
  };

  const selectBodyMatch = (query: string, index: number) => {
    const starts = getBodyMatchStarts(query);
    if (starts.length > 0) {
      const nextIndex = (index + starts.length) % starts.length;
      const nextStart = starts[nextIndex];
      setBodySearchIndex(nextIndex);
      bodyTextareaRef.current?.focus();
      bodyTextareaRef.current?.setSelectionRange(nextStart, nextStart + query.length);
    }
  };

  const countBodyMatches = (query: string) => {
    if (!query) return 0;
    let count = 0;
    let cursor = 0;
    const body = request.body.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    while ((cursor = body.indexOf(normalizedQuery, cursor)) >= 0) {
      count += 1;
      cursor += normalizedQuery.length;
    }
    return count;
  };

  const getUrlEncodedEntries = (): KeyValuePair[] => {
    try {
      const parsed = JSON.parse(request.body);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Support older text-form URL-encoded bodies.
    }

    return request.body
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => {
        const separator = line.indexOf('=');
        return {
          key: separator >= 0 ? line.slice(0, separator) : line,
          value: separator >= 0 ? line.slice(separator + 1) : '',
          enabled: true,
        };
      });
  };

  const updateUrlEncodedEntries = (entries: KeyValuePair[]) => {
    updateField('body', JSON.stringify(entries));
  };

  const handleBinaryFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateField('body', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const escapeBodySearch = (query: string) => query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const replaceBodyMatch = () => {
    const starts = getBodyMatchStarts(bodySearch);
    if (starts.length === 0) return;
    const matchStart = starts[Math.min(bodySearchIndex, starts.length - 1)];
    const updatedBody = `${request.body.slice(0, matchStart)}${bodyReplace}${request.body.slice(matchStart + bodySearch.length)}`;
    updateField('body', updatedBody);
    setTimeout(() => selectBodyMatch(bodySearch, bodySearchIndex), 0);
  };

  const replaceAllBodyMatches = () => {
    if (!bodySearch) return;
    updateField('body', request.body.replace(new RegExp(escapeBodySearch(bodySearch), 'gi'), bodyReplace));
    setBodySearchIndex(0);
  };

  const handleVariableDraftChange = (value: string) => {
    setVariableDraft(value);
    if (!hoveredVariable) return;
    if (variableSaveTimerRef.current !== null) {
      window.clearTimeout(variableSaveTimerRef.current);
    }
    const variable = hoveredVariable;
    variableSaveTimerRef.current = window.setTimeout(() => {
      void persistVariableValue(variable, value);
    }, 250);
  };

  const quoteCurlValue = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;
  const resolveValue = (value: string) => resolveInterpolation(value, environmentVariables);

  const buildCurlCommand = () => {
    let requestUrl = resolveValue(request.url);

    (request.pathParams || [])
      .filter(param => param.enabled && param.key)
      .forEach(param => {
        const key = param.key.replace(/^[:{}]*/, '').replace(/[}]*$/, '');
        const value = resolveValue(param.value || '');
        requestUrl = requestUrl
          .replace(new RegExp(`:${key}\\b`, 'g'), value)
          .replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      });

    const queryParams = request.params
      .filter(param => param.enabled && param.key)
      .map(param => `${encodeURIComponent(resolveValue(param.key))}=${encodeURIComponent(resolveValue(param.value))}`)
      .join('&');

    if (queryParams) {
      requestUrl += `${requestUrl.includes('?') ? '&' : '?'}${queryParams}`;
    }

    const command = [`curl --request ${request.method} ${quoteCurlValue(requestUrl)}`];

    request.headers
      .filter(header => header.enabled && header.key)
      .forEach(header => {
        command.push(`  --header ${quoteCurlValue(`${resolveValue(header.key)}: ${resolveValue(header.value)}`)}`);
      });

    if (request.auth.type === 'bearer' && request.auth.bearerToken) {
      command.push(`  --header ${quoteCurlValue(`Authorization: Bearer ${resolveValue(request.auth.bearerToken)}`)}`);
    } else if (request.auth.type === 'basic') {
      command.push(`  --user ${quoteCurlValue(`${resolveValue(request.auth.basicUsername || '')}:${resolveValue(request.auth.basicPassword || '')}`)}`);
    } else if (request.auth.type === 'apiKey' && request.auth.apiKeyName && request.auth.apiKeyValue) {
      const apiKeyName = resolveValue(request.auth.apiKeyName);
      const apiKeyValue = resolveValue(request.auth.apiKeyValue);
      if (request.auth.apiKeyPlacement === 'query') {
        const separator = requestUrl.includes('?') ? '&' : '?';
        command[0] = `curl --request ${request.method} ${quoteCurlValue(`${requestUrl}${separator}${encodeURIComponent(apiKeyName)}=${encodeURIComponent(apiKeyValue)}`)}`;
      } else {
        command.push(`  --header ${quoteCurlValue(`${apiKeyName}: ${apiKeyValue}`)}`);
      }
    }

    if (request.bodyType === 'urlencoded') {
      if (request.body) command.push(`  --data-urlencode ${quoteCurlValue(resolveValue(request.body))}`);
    } else if (request.bodyType !== 'none' && request.body) {
      command.push(`  --data-raw ${quoteCurlValue(resolveValue(request.body))}`);
    }

    return command.join(' \\\n');
  };

  const handleCopyCurl = async () => {
    await navigator.clipboard.writeText(buildCurlCommand());
    setCurlCopied(true);
    window.setTimeout(() => setCurlCopied(false), 2000);
  };

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
    const braceMatches = Array.from(newUrl.matchAll(/(?<!\{)\{([a-zA-Z0-9_]+)\}(?!\})/g)).map(m => m[1]);
    const detectedKeys = Array.from(new Set([...colonMatches, ...braceMatches]));

    let currentPathParams = request.pathParams || [];
    let updatedPathParams = currentPathParams.filter(param => {
      const key = param.key.replace(/^[:{}]*/, '').replace(/[}]*$/, '');
      return detectedKeys.includes(key) || !environmentVariables[key];
    });

    detectedKeys.forEach(k => {
      if (!updatedPathParams.some(p => p.key === k)) {
        updatedPathParams.push({ key: k, value: '', enabled: true });
      }
    });

    onUpdateRequest({ ...request, url: newUrl, pathParams: updatedPathParams });
  };

  const urlVariables = Array.from(request.url.matchAll(/\{\{([^{}]+)\}\}/g))
    .map(match => match[1].trim())
    .filter((key, index, keys) => keys.indexOf(key) === index);
  const renderUrlValue = () => {
    const parts: React.ReactNode[] = [];
    const pattern = /\{\{([^{}]+)\}\}|:([a-zA-Z0-9_]+)|(?<!\{)\{([a-zA-Z0-9_]+)\}(?!\})/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(request.url)) !== null) {
      if (match.index > lastIndex) {
        parts.push(request.url.slice(lastIndex, match.index));
      }

      const type = match[1] ? 'environment' : 'path';
      const key = (match[1] || match[2] || match[3]).trim();
      const pathVariable = (request.pathParams || []).find(param => (
        param.key.replace(/^[:{}]*/, '').replace(/[}]*$/, '') === key
      ));
      const resolvedValue = type === 'environment'
        ? resolveValue(match[0])
        : pathVariable?.value || match[0];
      const isResolved = resolvedValue !== match[0] && resolvedValue !== '';
      parts.push(
        <span
          key={`${key}-${match.index}`}
          className={`pointer-events-auto relative inline-block cursor-help rounded px-0.5 ${
            isResolved ? 'text-emerald-300 underline decoration-dotted' : 'text-amber-300 underline decoration-wavy'
          }`}
          onMouseEnter={() => openVariableEditor(key, type)}
          onMouseLeave={scheduleVariableEditorClose}
          onMouseDown={(event) => event.preventDefault()}
        >
          {match[0]}
          {hoveredVariable?.key === key && hoveredVariable.type === type && (
            <span
              className="absolute left-0 top-full z-50 mt-1 w-80 rounded-xl border border-zinc-700 bg-[#15151a] p-2 text-left normal-case no-underline shadow-2xl"
              onMouseEnter={() => openVariableEditor(key, type)}
              onMouseLeave={scheduleVariableEditorClose}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <input
                autoFocus
                value={variableDraft}
                onChange={(event) => handleVariableDraftChange(event.target.value)}
                onBlur={() => void saveVariableDraft()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveVariableDraft();
                }}
                placeholder="Enter variable value"
                className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
              />
            </span>
          )}
        </span>
      );
      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < request.url.length) {
      parts.push(request.url.slice(lastIndex));
    }

    return parts;
  };
  const visiblePathParams = (request.pathParams || [])
    .map((param, index) => ({ param, index }))
    .filter(({ param }) => {
      const key = param.key.trim().replace(/^[:{}]*/, '').replace(/[}]*$/, '');
      return new RegExp(`:${key}\\b`).test(request.url)
        || new RegExp(`(?<!\\{)\\{${key}\\}(?!\\})`).test(request.url);
    });

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
  const getRawStarterBody = (format: RawBodyFormat) => {
    switch (format) {
      case 'javascript': return '// JavaScript request body\n';
      case 'json': return '{}';
      case 'html': return '<!doctype html>\n<html>\n  <body></body>\n</html>';
      case 'xml': return '<root></root>';
      default: return '';
    }
  };

  const getBodyDraftKey = (bodyType: BodyType, rawFormat: RawBodyFormat): BodyDraftKey => {
    if (bodyType === 'json' || ((bodyType === 'raw' || bodyType === 'xml') && rawFormat === 'json')) {
      return 'json';
    }
    if (bodyType === 'raw' || bodyType === 'xml') {
      return `raw:${rawFormat}`;
    }
    return bodyType;
  };

  const getBodyStarter = (bodyType: BodyType, rawFormat: RawBodyFormat) => {
    if (bodyType === 'json') return '{}';
    if (bodyType === 'raw' || bodyType === 'xml') return getRawStarterBody(rawFormat);
    return '';
  };

  const handleBodyTypeChange = (bodyType: BodyType) => {
    const bodyDrafts = {
      ...request.bodyDrafts,
      [getBodyDraftKey(request.bodyType, currentRawFormat)]: request.body,
    };
    const nextRawFormat: RawBodyFormat = bodyType === 'xml'
      ? 'xml'
      : bodyType === 'raw'
        ? request.rawFormat && request.rawFormat !== 'json'
          ? request.rawFormat
          : request.bodyType === 'xml' ? 'xml' : 'text'
        : currentRawFormat;
    const nextDraftKey = getBodyDraftKey(bodyType, nextRawFormat);

    onUpdateRequest({
      ...request,
      bodyType,
      body: bodyDrafts[nextDraftKey] ?? getBodyStarter(bodyType, nextRawFormat),
      bodyDrafts,
      ...(bodyType === 'raw' ? { rawFormat: nextRawFormat } : {}),
    });
  };

  const handleRawFormatChange = (rawFormat: RawBodyFormat) => {
    const bodyDrafts = {
      ...request.bodyDrafts,
      [getBodyDraftKey(request.bodyType, currentRawFormat)]: request.body,
    };

    onUpdateRequest({
      ...request,
      bodyType: 'raw',
      rawFormat,
      body: bodyDrafts[getBodyDraftKey('raw', rawFormat)] ?? getRawStarterBody(rawFormat),
      bodyDrafts,
    });
  };

  const currentRawFormat: RawBodyFormat = request.rawFormat
    ? request.bodyType === 'json' ? 'json' : request.rawFormat
    : request.bodyType === 'json' ? 'json' : request.bodyType === 'xml' ? 'xml' : 'text';
  const bodyTypeLabels: Record<BodyType, string> = {
    none: 'none',
    formdata: 'form-data',
    urlencoded: 'x-www-form-urlencoded',
    raw: 'raw',
    binary: 'binary',
    json: 'raw',
    xml: 'raw',
  };
  const bodyPlaceholder = currentRawFormat === 'json'
    ? '{\n  "title": "My Post",\n  "userId": 1\n}'
    : currentRawFormat === 'xml'
      ? '<user><name>Ada</name></user>'
      : currentRawFormat === 'html'
        ? '<h1>Hello</h1>'
        : currentRawFormat === 'javascript'
          ? 'const payload = { hello: "world" };'
          : '';

  useEffect(() => {
    if (request.bodyType !== 'json') return;

    const previousRawFormat = request.rawFormat;
    const isStaleRawStarter = previousRawFormat
      && previousRawFormat !== 'json'
      && request.body === getRawStarterBody(previousRawFormat);

    if (isStaleRawStarter) {
      onUpdateRequest({
        ...request,
        body: '{}',
        bodyDrafts: {
          ...request.bodyDrafts,
          [`raw:${previousRawFormat}`]: request.body,
        },
      });
    } else if (!request.body.trim()) {
      onUpdateRequest({ ...request, body: '{}' });
    }
  }, [request.id, request.bodyType, request.body, request.rawFormat]);

  const formatJsonBody = () => {
    try {
      const parsed = JSON.parse(request.body);
      updateField('body', JSON.stringify(parsed, null, 2));
    } catch {
      alert('Invalid JSON: Unable to format');
    }
  };

  const formatRawBody = () => {
    if (!request.body.trim()) return;

    try {
      if (currentRawFormat === 'json') {
        updateField('body', JSON.stringify(JSON.parse(request.body), null, 2));
        return;
      }

      if (currentRawFormat === 'xml' || currentRawFormat === 'html') {
        const formatted = request.body
          .replace(/>\s*</g, '><')
          .replace(/></g, '>\n<')
          .split('\n')
          .reduce((lines: string[], line) => {
            const trimmed = line.trim();
            if (!trimmed) return lines;
            const closingTag = trimmed.startsWith('</');
            const currentIndent = Math.max(0, lines.length ? (lines[lines.length - 1].match(/^\s*/)?.[0].length || 0) / 2 + (closingTag ? -1 : 0) : 0);
            lines.push(`${'  '.repeat(currentIndent)}${trimmed}`);
            return lines;
          }, [])
          .join('\n');
        updateField('body', formatted);
        return;
      }

      if (currentRawFormat === 'javascript') {
        updateField('body', request.body.replace(/;\s*/g, ';\n').replace(/\{\s*/g, '{\n').replace(/\s*\}/g, '\n}').trim());
      }
    } catch {
      alert(`Unable to beautify ${currentRawFormat.toLowerCase()} body`);
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
    <div
      className="flex flex-col h-full select-none"
      style={{ background: 'var(--app-surface)', color: 'var(--text-primary)' }}
    >
      {/* Top Request Bar: Name, Save */}
      <div
        className="px-4 py-2 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--app-border)' }}
      >
        <input
          type="text"
          value={request.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="Request Name"
          className="bg-transparent font-medium text-sm focus:outline-none border-b border-transparent focus:border-emerald-500 transition-colors w-1/3"
          style={{ color: 'var(--text-primary)' }}
        />

        <div className="flex items-center gap-2">
          <button
            onClick={onSaveRequest}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-colors"
            style={{ background: 'var(--app-surface-soft)', borderColor: 'var(--app-border)', color: 'var(--text-primary)' }}
            title="Save request changes to local file"
          >
            <Save className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <span>Save</span>
          </button>

          <button
            onClick={onToggleCodeSnippet || (() => setCurlPreviewOpen(true))}
            className={`flex items-center justify-center h-7 px-2.5 rounded text-xs font-mono font-bold border transition-colors ${
              isCodeSnippetOpen
                ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-400 shadow-sm'
                : 'hover:bg-zinc-800 border-zinc-700/70 text-zinc-300 hover:text-zinc-100'
            }`}
            style={{ borderColor: isCodeSnippetOpen ? undefined : 'var(--app-border)' }}
            title={isCodeSnippetOpen ? 'Close code snippet' : 'Code snippet'}
            aria-label="Code snippet"
          >
            <span className="text-[12px] font-mono leading-none">&lt;/&gt;</span>
          </button>
        </div>
      </div>

      {curlPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="curl-preview-title">
          <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-800 bg-[#15151a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <h3 id="curl-preview-title" className="text-sm font-semibold text-zinc-100">Generated cURL</h3>
                <p className="text-[11px] text-zinc-400">Inspect or copy the command for this request.</p>
              </div>
              <button
                onClick={() => setCurlPreviewOpen(false)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                title="Close cURL preview"
                aria-label="Close cURL preview"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            <div className="p-4">
              <textarea
                value={buildCurlCommand()}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                className="h-64 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed text-zinc-200 focus:outline-none focus:border-emerald-500"
                spellCheck={false}
                aria-label="Generated cURL command"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 bg-[#121216] px-4 py-3">
              <button
                onClick={() => setCurlPreviewOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Close
              </button>
              <button
                onClick={handleCopyCurl}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                {curlCopied ? <Check className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
                <span>{curlCopied ? 'Copied' : 'Copy cURL'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Address Bar */}
      <div className="p-4 pb-3 flex items-center gap-2">
        {/* Method Dropdown */}
        <select
          value={request.method}
          onChange={handleMethodChange}
          className="text-xs font-bold font-mono px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer"
          style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: 'var(--brand)' }}
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
            className={`w-full rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors ${request.url ? 'text-transparent caret-zinc-200' : ''}`}
            style={{ background: 'var(--app-surface-soft)', border: '1px solid var(--app-border)', color: request.url ? 'transparent' : 'var(--text-primary)' }}
          />
          {request.url && urlVariables.length > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre px-3 py-2 text-xs font-mono text-zinc-200"
            >
              {renderUrlValue()}
            </div>
          )}
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

        <button
          onClick={() => setActiveTab('script')}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'script'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Script
          {request.script && request.script.trim() && (
            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
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
                    {visiblePathParams.map(({ param: p, index: idx }) => (
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
                    {visiblePathParams.length === 0 && (
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
                {(['none', 'json'] as BodyType[]).map((type) => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                    <input
                      type="radio"
                      name="bodyType"
                      value={type}
                      checked={type === 'json'
                        ? request.bodyType === 'json' || ((request.bodyType === 'raw' || request.bodyType === 'xml') && currentRawFormat === 'json')
                        : request.bodyType === type}
                      onChange={() => handleBodyTypeChange(type)}
                      className="text-emerald-500 focus:ring-0"
                    />
                    {type.toLowerCase()}
                  </label>
                ))}
                {(['formdata', 'urlencoded', 'raw', 'binary'] as BodyType[]).map((type) => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer text-zinc-300">
                    <input
                      type="radio"
                      name="bodyType"
                      value={type}
                      checked={type === 'raw'
                        ? (request.bodyType === 'raw' || request.bodyType === 'xml') && currentRawFormat !== 'json'
                        : request.bodyType === type}
                      onChange={() => handleBodyTypeChange(type)}
                      className="text-emerald-500 focus:ring-0"
                    />
                    {bodyTypeLabels[type].toLowerCase()}
                  </label>
                ))}
                {(request.bodyType === 'raw' || request.bodyType === 'xml') && currentRawFormat !== 'json' && (
                  <select
                    value={currentRawFormat}
                    onChange={(event) => handleRawFormatChange(event.target.value as RawBodyFormat)}
                    className="rounded bg-transparent px-1 text-xs text-zinc-300 outline-none"
                    aria-label="Raw body format"
                  >
                    <option className="bg-zinc-950 text-zinc-200" value="text">text</option>
                    <option className="bg-zinc-950 text-zinc-200" value="javascript">javascript</option>
                    <option className="bg-zinc-950 text-zinc-200" value="html">html</option>
                    <option className="bg-zinc-950 text-zinc-200" value="xml">xml</option>
                  </select>
                )}
              </div>

              {(request.bodyType === 'json' || (request.bodyType === 'raw' && currentRawFormat !== 'text')) && (
                <button
                  onClick={request.bodyType === 'json' ? formatJsonBody : formatRawBody}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded transition-colors"
                  title={`Beautify ${currentRawFormat.toLowerCase()} body`}
                >
                  <Wand2 className="w-3 h-3 text-emerald-400" />
                  Beautify
                </button>
              )}
            </div>

            {(request.bodyType === 'urlencoded' || request.bodyType === 'formdata') && (
              <div className="flex-1 min-h-[220px] space-y-2">
                <div className="text-[11px] text-zinc-500">Each enabled row becomes one {request.bodyType === 'formdata' ? 'multipart' : 'URL-encoded'} form field.</div>
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-400">
                      <tr><th className="p-2 w-8"></th><th className="p-2">Key</th><th className="p-2">Value</th><th className="p-2 w-8"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
                      {getUrlEncodedEntries().map((entry, index) => (
                        <tr key={index}>
                          <td className="p-2 text-center"><input type="checkbox" checked={entry.enabled} onChange={(event) => {
                            const entries = getUrlEncodedEntries();
                            entries[index] = { ...entries[index], enabled: event.target.checked };
                            updateUrlEncodedEntries(entries);
                          }} /></td>
                          <td className="p-2"><input value={entry.key} onChange={(event) => {
                            const entries = getUrlEncodedEntries();
                            entries[index] = { ...entries[index], key: event.target.value };
                            updateUrlEncodedEntries(entries);
                          }} placeholder="key" className="w-full bg-transparent text-zinc-200 outline-none" /></td>
                          <td className="p-2"><input value={entry.value} onChange={(event) => {
                            const entries = getUrlEncodedEntries();
                            entries[index] = { ...entries[index], value: event.target.value };
                            updateUrlEncodedEntries(entries);
                          }} placeholder="value" className="w-full bg-transparent text-zinc-200 outline-none" /></td>
                          <td className="p-2 text-center"><button onClick={() => updateUrlEncodedEntries(getUrlEncodedEntries().filter((_, rowIndex) => rowIndex !== index))} className="text-zinc-500 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => updateUrlEncodedEntries([...getUrlEncodedEntries(), { key: '', value: '', enabled: true }])} className="text-xs text-emerald-400 hover:text-emerald-300">+ Add field</button>
              </div>
            )}

            {request.bodyType === 'binary' && (
              <div className="flex-1 min-h-[220px] rounded-lg border border-dashed border-zinc-700 bg-zinc-950/50 p-6">
                <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 text-xs text-zinc-400 hover:text-zinc-200">
                  <span className="text-emerald-400">Choose binary file</span>
                  <span className="text-[11px] text-zinc-500">Courier stores the selected file as request data for this request.</span>
                  <input type="file" className="hidden" onChange={(event) => handleBinaryFile(event.target.files?.[0])} />
                </label>
                {request.body && <div className="mt-3 text-center text-[10px] text-emerald-400">Binary payload selected</div>}
              </div>
            )}

            {request.bodyType !== 'none' && request.bodyType !== 'urlencoded' && request.bodyType !== 'formdata' && request.bodyType !== 'binary' && (
              <div className="relative flex-1 min-h-[220px]">
                {bodySearchOpen && (
                  <div className="absolute right-2 top-2 z-10 rounded-lg border border-zinc-700 bg-[#15151a] p-1.5 shadow-xl">
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={bodySearch}
                        onChange={(event) => {
                          setBodySearch(event.target.value);
                          setBodySearchIndex(0);
                          selectBodyMatch(event.target.value, 0);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            selectBodyMatch(bodySearch, bodySearchIndex + 1);
                          }
                          if (event.key === 'Escape') setBodySearchOpen(false);
                        }}
                        placeholder="Find in request body"
                        className="w-48 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-emerald-500"
                      />
                      <span className="min-w-[42px] text-center text-[10px] text-zinc-500">{countBodyMatches(bodySearch) ? `${bodySearchIndex + 1}/${countBodyMatches(bodySearch)}` : '0/0'}</span>
                      <button onClick={() => setBodyReplaceOpen(open => !open)} className="text-[10px] text-zinc-400 hover:text-zinc-200" title="Toggle replace">Replace</button>
                      <button onClick={() => selectBodyMatch(bodySearch, 0)} className="text-zinc-400 hover:text-zinc-200" title="First match"><ChevronFirst className="h-3.5 w-3.5" /></button>
                      <button onClick={() => selectBodyMatch(bodySearch, bodySearchIndex - 1)} className="text-zinc-400 hover:text-zinc-200" title="Previous match"><ChevronLeft className="h-3.5 w-3.5" /></button>
                      <button onClick={() => selectBodyMatch(bodySearch, bodySearchIndex + 1)} className="text-zinc-400 hover:text-zinc-200" title="Next match"><ChevronRight className="h-3.5 w-3.5" /></button>
                      <button onClick={() => selectBodyMatch(bodySearch, countBodyMatches(bodySearch) - 1)} className="text-zinc-400 hover:text-zinc-200" title="Last match"><ChevronLast className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setBodySearchOpen(false)} className="px-1 text-zinc-400 hover:text-zinc-200" title="Close find">×</button>
                    </div>
                    {bodyReplaceOpen && (
                      <div className="mt-1 flex items-center gap-2 border-t border-zinc-800 pt-1.5">
                        <input
                          value={bodyReplace}
                          onChange={(event) => setBodyReplace(event.target.value)}
                          placeholder="Replace with"
                          className="w-48 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-emerald-500"
                        />
                        <button onClick={replaceBodyMatch} className="text-[10px] text-zinc-400 hover:text-zinc-200">Replace</button>
                        <button onClick={replaceAllBodyMatches} className="text-[10px] text-zinc-400 hover:text-zinc-200">Replace All</button>
                      </div>
                    )}
                  </div>
                )}
                <textarea
                  ref={bodyTextareaRef}
                  value={request.body}
                  onChange={(e) => updateField('body', e.target.value)}
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
                      event.preventDefault();
                      setBodySearchOpen(true);
                    }
                  }}
                  placeholder={bodyPlaceholder}
                  className="h-full w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
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
                        No test assertions added yet. Click one of the presets above to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCRIPT TAB: Post-Response Scripting & Assertions */}
        {activeTab === 'script' && (
          <div className="flex flex-col h-full space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Post-Response Script
                </h4>
                <p className="text-[11px] text-zinc-500">
                  Executes automatically upon response receipt. Sandbox supports <code className="text-emerald-400">expect()</code>, <code className="text-emerald-400">setEnv()</code>, and <code className="text-emerald-400">pm.*</code>.
                </p>
              </div>

              {/* Quick Snippet Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const snippet = '\nexpect(response.status).toBe(200);\n';
                    updateField('script', (request.script || '') + snippet);
                  }}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors border border-zinc-700/60"
                  title="Assert HTTP Status 200"
                >
                  + expect status 200
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const snippet = '\nsetEnv("token", response.data?.token || "collection_val");\n';
                    updateField('script', (request.script || '') + snippet);
                  }}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-purple-300 px-2 py-1 rounded transition-colors border border-purple-800/60"
                  title="Save locally in active Collection/Folder scope"
                >
                  + setEnv() [Collection]
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const snippet = '\nsetGlobalEnv("apiBase", response.data?.baseUrl || "https://api.example.com");\n';
                    updateField('script', (request.script || '') + snippet);
                  }}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-emerald-300 px-2 py-1 rounded transition-colors border border-emerald-800/60"
                  title="Promote and save to Global Workspace level"
                >
                  + setGlobalEnv() [Global]
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const snippet = '\nexpect(response.timeMs).toBeLessThan(1000);\n';
                    updateField('script', (request.script || '') + snippet);
                  }}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors border border-zinc-700/60"
                  title="Assert response timing"
                >
                  + latency &lt; 1000ms
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const snippet = '\nexpect(response.data).toBeDefined();\n';
                    updateField('script', (request.script || '') + snippet);
                  }}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors border border-zinc-700/60"
                  title="Assert data is defined"
                >
                  + data defined
                </button>
              </div>
            </div>

            {/* Script Textarea Editor */}
            <div className="flex-1 flex flex-col min-h-[220px]">
              <textarea
                value={request.script || ''}
                onChange={(e) => updateField('script', e.target.value)}
                placeholder={`// Example: Post-response test script\nexpect(response.status).toBe(200);\nexpect(response.timeMs).toBeLessThan(1500);\n\n// 1. Save variable in Collection/Folder scope:\nsetEnv("localToken", response.data?.token);\n\n// 2. Promote variable to Global Workspace level:\nsetGlobalEnv("authToken", response.data?.token);\n\n// Postman / Bruno compatibility:\n// pm.test("Has valid payload", () => pm.expect(pm.response.code).to.equal(200));`}
                className="w-full flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>

            {/* Sandbox Reference Quick-Guide */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-2.5 text-[11px] text-zinc-400 space-y-1">
              <span className="font-semibold text-zinc-300 block text-[11px]">Runtime Sandbox Globals:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-zinc-400">
                <div><span className="text-emerald-400">expect(val).toBe(exp)</span> - strict equality</div>
                <div><span className="text-purple-400">setEnv(k, v)</span> - saves locally in Collection/Folder scope</div>
                <div><span className="text-emerald-400">expect(val).toEqual(exp)</span> - deep JSON match</div>
                <div><span className="text-emerald-400">setGlobalEnv(k, v)</span> - promotes to Global Workspace env</div>
                <div><span className="text-emerald-400">expect(val).toContain(sub)</span> - array/string includes</div>
                <div><span className="text-zinc-300">getEnv(k)</span> - searches Folder -&gt; Collection -&gt; Global</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


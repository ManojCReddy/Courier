import React, { useState } from 'react';
import {
  Copy,
  Check,
  Clock,
  HardDrive,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Stethoscope
} from 'lucide-react';
import { HttpResponse } from '../types';

interface ResponsePanelProps {
  response: HttpResponse | null;
  isLoading: boolean;
  onDiagnoseWithCopilot?: () => void;
  onAutoGenerateTests?: () => void;
}

export const ResponsePanel: React.FC<ResponsePanelProps> = ({
  response,
  isLoading,
  onDiagnoseWithCopilot,
  onAutoGenerateTests,
}) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'tests'>('body');
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) {
      return 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60';
    }
    if (status >= 300 && status < 400) {
      return 'bg-blue-950/60 text-blue-400 border-blue-800/60';
    }
    if (status >= 400 && status < 500) {
      return 'bg-amber-950/60 text-amber-400 border-amber-800/60';
    }
    if (status >= 500) {
      return 'bg-rose-950/60 text-rose-400 border-rose-800/60';
    }
    return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  };

  const handleCopyBody = () => {
    if (!response) return;
    const text = typeof response.data === 'string'
      ? response.data
      : JSON.stringify(response.data, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleCopyCurl = () => {
    if (!response?.curlCommand) return;
    navigator.clipboard.writeText(response.curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#101014] text-zinc-500 gap-3 border-t md:border-t-0 md:border-l border-zinc-800">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">Executing local request...</span>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#101014] text-zinc-600 gap-2 border-t md:border-t-0 md:border-l border-zinc-800 select-none p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-1">
          <Terminal className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-zinc-400">Response Panel</p>
        <p className="text-xs text-zinc-500 max-w-xs">
          Hit <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-zinc-700">Send</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-zinc-700">Ctrl+Enter</kbd> to execute this request.
        </p>
      </div>
    );
  }

  const passedTestsCount = response.testResults?.filter(t => t.passed).length || 0;
  const totalTestsCount = response.testResults?.length || 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#101014] border-t md:border-t-0 md:border-l border-zinc-800 select-none overflow-hidden">
      {/* Top Status Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-zinc-800 bg-[#121216]">
        {/* Status, Time, Size */}
        <div className="flex items-center gap-3 text-xs">
          <span className={`px-2.5 py-1 rounded-md font-mono font-bold border flex items-center gap-1.5 ${getStatusBadge(response.status)}`}>
            {response.status ? (
              <>
                <span>{response.status}</span>
                <span>{response.statusText}</span>
              </>
            ) : (
              <span>Network Error</span>
            )}
          </span>

          <div className="flex items-center gap-1 text-zinc-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>{response.timeMs} ms</span>
          </div>

          <div className="flex items-center gap-1 text-zinc-400 font-mono">
            <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
            <span>{formatBytes(response.sizeBytes)}</span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {response.status >= 400 && onDiagnoseWithCopilot && (
            <button
              onClick={onDiagnoseWithCopilot}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/80 transition-colors"
              title="Diagnose error with Chetan"
            >
              <Stethoscope className="w-3.5 h-3.5 text-amber-400" />
              <span>Diagnose Error</span>
            </button>
          )}

          {response.status >= 200 && response.status < 400 && onAutoGenerateTests && (
            <button
              onClick={onAutoGenerateTests}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 border border-purple-800/50 transition-colors"
              title="Auto-generate test assertions with AI"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              <span>Gen Tests</span>
            </button>
          )}

          <button
            onClick={handleCopyCurl}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
            title="Copy as cURL command"
          >
            {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Terminal className="w-3 h-3 text-zinc-400" />}
            <span>cURL</span>
          </button>

          <button
            onClick={handleCopyBody}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
            title="Copy response body"
          >
            {copiedResponse ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
            <span>Copy</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center border-b border-zinc-800 px-4 text-xs bg-[#101014]">
        <button
          onClick={() => setActiveTab('body')}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'body'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Response Body
        </button>

        <button
          onClick={() => setActiveTab('headers')}
          className={`py-2 px-3 border-b-2 font-medium transition-colors ${
            activeTab === 'headers'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Headers ({Object.keys(response.headers || {}).length})
        </button>

        <button
          onClick={() => setActiveTab('tests')}
          className={`py-2 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors ${
            activeTab === 'tests'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>Test Results</span>
          {totalTestsCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
              passedTestsCount === totalTestsCount
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                : 'bg-rose-950 text-rose-400 border border-rose-800'
            }`}>
              {passedTestsCount}/{totalTestsCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* BODY TAB */}
        {activeTab === 'body' && (
          <div className="h-full">
            <pre className="font-mono text-xs text-zinc-200 bg-zinc-950/80 p-4 rounded-lg border border-zinc-800/80 overflow-auto whitespace-pre-wrap leading-relaxed select-text">
              {typeof response.data === 'object'
                ? JSON.stringify(response.data, null, 2)
                : String(response.data || 'No content')}
            </pre>
          </div>
        )}

        {/* HEADERS TAB */}
        {activeTab === 'headers' && (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-2.5 w-1/3">Header Name</th>
                  <th className="p-2.5 w-2/3">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40 select-text font-mono">
                {Object.entries(response.headers || {}).map(([k, v]) => (
                  <tr key={k} className="hover:bg-zinc-900/40">
                    <td className="p-2.5 text-zinc-300 font-semibold">{k}</td>
                    <td className="p-2.5 text-zinc-400 break-all">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TESTS TAB */}
        {activeTab === 'tests' && (
          <div className="space-y-3">
            {totalTestsCount === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs italic">
                No assertions configured for this request. Configure them in the "Test Assertions" tab or click "Gen Tests" to let Courier Copilot write them automatically.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-zinc-400 font-medium">
                  {passedTestsCount} of {totalTestsCount} assertions passed
                </div>

                {response.testResults?.map((test) => (
                  <div
                    key={test.id}
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                      test.passed
                        ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-200'
                        : 'bg-rose-950/20 border-rose-900/50 text-rose-200'
                    }`}
                  >
                    {test.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{test.name}</div>
                      <div className="text-[11px] opacity-80 mt-0.5 font-mono">{test.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


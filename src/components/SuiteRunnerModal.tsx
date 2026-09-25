import React, { useState } from 'react';
import { X, Play, CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react';
import { CourierCollection, Environment, HttpResponse, CourierRequest } from '../types';
import { executeRequest } from '../services/api';
import { resolveRequestEnvironment } from '../services/environmentScoping';

interface SuiteRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: CourierCollection[];
  environments: Environment[];
  selectedEnvId: string;
}

interface RunLog {
  request: CourierRequest;
  response?: HttpResponse;
  status: 'pending' | 'running' | 'success' | 'fail';
  error?: string;
}

export const SuiteRunnerModal: React.FC<SuiteRunnerModalProps> = ({
  isOpen,
  onClose,
  collections,
  environments,
  selectedEnvId,
}) => {
  const [selectedColId, setSelectedColId] = useState<string>(collections[0]?.id || '');
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<RunLog[]>([]);

  if (!isOpen) return null;

  const activeCol = collections.find(c => c.id === selectedColId) || collections[0];
  const activeEnv = environments.find(e => e.id === selectedEnvId);

  const envVariables: Record<string, string> = {};
  if (activeEnv?.variables) {
    activeEnv.variables.forEach(v => {
      if (v.enabled) envVariables[v.key] = v.value;
    });
  }

  const handleStartRun = async () => {
    if (!activeCol || isRunning) return;
    setIsRunning(true);

    const initialLogs: RunLog[] = activeCol.requests.map(req => ({
      request: req,
      status: 'pending',
    }));
    setLogs(initialLogs);

    for (let i = 0; i < activeCol.requests.length; i++) {
      const req = activeCol.requests[i];

      // Mark running
      setLogs(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'running' };
        return next;
      });

      try {
        const { variables: tieredVars } = resolveRequestEnvironment(collections, req.id, activeEnv);
        const res = await executeRequest(req, tieredVars);
        const hasFailedTests = res.testResults?.some(t => !t.passed);
        const isSuccess = res.status >= 200 && res.status < 400 && !hasFailedTests;

        setLogs(prev => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            response: res,
            status: isSuccess ? 'success' : 'fail',
          };
          return next;
        });
      } catch (err: any) {
        setLogs(prev => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: 'fail',
            error: err.message,
          };
          return next;
        });
      }
    }

    setIsRunning(false);
  };

  const total = logs.length;
  const passed = logs.filter(l => l.status === 'success').length;
  const failed = logs.filter(l => l.status === 'fail').length;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#15151a] border border-zinc-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[540px]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-[#121216]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <Play className="w-4 h-4 fill-emerald-400/30" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-zinc-100">Collection Test Suite Runner</h3>
              <p className="text-[11px] text-zinc-400">Execute all requests and evaluate assertions sequentially</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Suite Controls */}
        <div className="p-4 border-b border-zinc-800 bg-[#141418] flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <label className="text-zinc-400 font-medium">Collection:</label>
            <select
              value={selectedColId}
              onChange={(e) => setSelectedColId(e.target.value)}
              disabled={isRunning}
              className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 font-medium"
            >
              {collections.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.requests.length} reqs)</option>
              ))}
            </select>

            <span className="text-zinc-500">|</span>

            <span className="text-zinc-400">Environment:</span>
            <span className="text-zinc-200 font-medium bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              {activeEnv?.name || 'No Environment'}
            </span>
          </div>

          <button
            onClick={handleStartRun}
            disabled={isRunning || !activeCol || activeCol.requests.length === 0}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-4 py-1.5 rounded-lg shadow-sm transition-colors"
          >
            {isRunning ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Running Suite...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run Collection</span>
              </>
            )}
          </button>
        </div>

        {/* Progress Bar & Summary */}
        {total > 0 && (
          <div className="px-5 py-2.5 bg-zinc-900/60 border-b border-zinc-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-4">
              <span className="text-zinc-400">Total: {total}</span>
              <span className="text-emerald-400">Passed: {passed}</span>
              <span className={failed > 0 ? 'text-rose-400' : 'text-zinc-500'}>Failed: {failed}</span>
            </div>

            <div className="w-48 bg-zinc-800 rounded-full h-2 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${(passed / total) * 100}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${(failed / total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Execution Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#101014]">
          {logs.length === 0 ? (
            <div className="text-center py-16 text-zinc-500 text-xs italic">
              Select a collection and click "Run Collection" to execute test suite.
            </div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 text-xs flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                      {log.request.method}
                    </span>
                    <span className="font-semibold text-zinc-200">{log.request.name}</span>
                    <span className="text-[11px] text-zinc-500 font-mono">{log.request.url}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {log.status === 'running' && (
                      <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    {log.status === 'success' && (
                      <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{log.response?.status} OK ({log.response?.timeMs}ms)</span>
                      </span>
                    )}
                    {log.status === 'fail' && (
                      <span className="flex items-center gap-1 text-rose-400 font-mono text-[11px]">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{log.response?.status || 'Error'} ({log.response?.timeMs || 0}ms)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Assertions Result detail */}
                {log.response?.testResults && log.response.testResults.length > 0 && (
                  <div className="ml-7 pl-2 border-l border-zinc-800 space-y-0.5 mt-1">
                    {log.response.testResults.map((t, tIdx) => (
                      <div key={tIdx} className="flex items-center gap-1.5 text-[11px]">
                        {t.passed ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-rose-400">✗</span>
                        )}
                        <span className={t.passed ? 'text-zinc-400' : 'text-rose-300 font-medium'}>
                          {t.name}
                        </span>
                        {!t.passed && (
                          <span className="text-rose-400 text-[10px] font-mono">({t.message})</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};


import React, { useEffect, useMemo, useState } from 'react';
import { X, Network, Search, Box, Route } from 'lucide-react';
import { fetchApiMap, fetchSpecs } from '../services/api';
import { ApiMap, MapEndpoint, MapModel, SpecSummary } from '../types';

interface ApiExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSpecId?: string | null;
  specsVersion: number;
}

type Selection = { kind: 'endpoint' | 'model'; id: string } | null;

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  PATCH: 'text-violet-400',
  DELETE: 'text-rose-400',
};

export const ApiExplorerModal: React.FC<ApiExplorerModalProps> = ({ isOpen, onClose, initialSpecId, specsVersion }) => {
  const [specs, setSpecs] = useState<SpecSummary[]>([]);
  const [specId, setSpecId] = useState('');
  const [map, setMap] = useState<ApiMap | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'endpoints' | 'models'>('endpoints');
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    fetchSpecs()
      .then((list) => {
        setSpecs(list);
        setSpecId((current) => {
          if (initialSpecId && list.some(s => s.id === initialSpecId)) return initialSpecId;
          return list.some(s => s.id === current) ? current : list[0]?.id || '';
        });
      })
      .catch((err) => setError(err.message));
  }, [isOpen, initialSpecId, specsVersion]);

  useEffect(() => {
    if (!isOpen || !specId) {
      setMap(null);
      return;
    }
    setError('');
    setSelection(null);
    fetchApiMap(specId).then(setMap).catch((err) => setError(err.message));
  }, [isOpen, specId]);

  const needle = query.trim().toLowerCase();
  const endpoints = useMemo(
    () => (map?.endpoints || []).filter(e => !needle || `${e.method} ${e.path} ${e.name} ${e.tag}`.toLowerCase().includes(needle)),
    [map, needle]
  );
  const models = useMemo(
    () => (map?.models || []).filter(m => !needle || m.name.toLowerCase().includes(needle)),
    [map, needle]
  );
  const groupedEndpoints = useMemo(() => {
    const groups = new Map<string, MapEndpoint[]>();
    for (const e of endpoints) groups.set(e.tag, [...(groups.get(e.tag) || []), e]);
    return [...groups.entries()];
  }, [endpoints]);

  if (!isOpen) return null;

  const modelByName = new Map((map?.models || []).map(m => [m.name, m]));
  const endpointByKey = new Map((map?.endpoints || []).map(e => [e.key, e]));
  const selectedModel = selection?.kind === 'model' ? modelByName.get(selection.id) : undefined;
  const selectedEndpoint = selection?.kind === 'endpoint' ? endpointByKey.get(selection.id) : undefined;

  const goModel = (name: string) => {
    if (!modelByName.has(name)) return;
    setTab('models');
    setQuery('');
    setSelection({ kind: 'model', id: name });
  };
  const goEndpoint = (key: string) => {
    setTab('endpoints');
    setQuery('');
    setSelection({ kind: 'endpoint', id: key });
  };

  const ModelChip = ({ name }: { name: string }) => (
    <button
      onClick={() => goModel(name)}
      disabled={!modelByName.has(name)}
      className="px-1.5 py-0.5 rounded bg-sky-950/50 border border-sky-800/50 text-sky-300 text-[11px] font-mono hover:bg-sky-900/60 disabled:opacity-60"
    >
      {name}
    </button>
  );

  const EndpointChip = ({ endpoint, direct }: { endpoint: string; direct?: boolean }) => {
    const e = endpointByKey.get(endpoint);
    return (
      <button
        onClick={() => goEndpoint(endpoint)}
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800 text-[11px] font-mono text-left w-full"
      >
        <span className={`w-12 font-semibold ${METHOD_COLORS[e?.method || ''] || 'text-zinc-300'}`}>{e?.method}</span>
        <span className="text-zinc-300 truncate">{e?.path}</span>
        {direct === false && <span className="ml-auto text-[10px] text-zinc-500">indirect</span>}
      </button>
    );
  };

  const renderModel = (model: MapModel) => (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-sky-400" />
          <h4 className="text-sm font-semibold text-zinc-100 font-mono">{model.name}</h4>
          <span className="text-[11px] text-zinc-500">{model.type}</span>
        </div>
        {model.description && <p className="mt-1 text-xs text-zinc-400">{model.description}</p>}
      </div>

      {model.enum && (
        <div className="flex flex-wrap gap-1">
          {model.enum.map((v, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[11px] font-mono text-zinc-300">{String(v)}</span>
          ))}
        </div>
      )}

      {model.fields.length > 0 && (
        <section>
          <h5 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Fields ({model.fields.length})</h5>
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-900 text-zinc-400">
                <tr><th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2">Description</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {model.fields.map(f => (
                  <tr key={f.name}>
                    <td className="p-2 text-zinc-200">
                      {f.name}
                      {f.required && <span className="ml-1 text-rose-400" title="required">*</span>}
                    </td>
                    <td className="p-2">
                      {f.refs.length > 0 ? (
                        <span className="flex flex-wrap items-center gap-1">
                          {f.refs.map(r => <ModelChip key={r} name={r} />)}
                          {f.type.startsWith('array<') && <span className="text-zinc-500">[]</span>}
                        </span>
                      ) : (
                        <span className="text-zinc-400">{f.type}</span>
                      )}
                    </td>
                    <td className="p-2 text-zinc-500 font-sans">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4">
        <section>
          <h5 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">References ({model.refsOut.length})</h5>
          <div className="flex flex-wrap gap-1">
            {model.refsOut.length ? model.refsOut.map(r => <ModelChip key={r} name={r} />) : <span className="text-xs text-zinc-600">None</span>}
            {model.selfReferencing && <span className="text-[11px] text-zinc-500">(self-referencing)</span>}
          </div>
        </section>
        <section>
          <h5 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Referenced by ({model.usedBy.length})</h5>
          <div className="flex flex-wrap gap-1">
            {model.usedBy.length ? model.usedBy.map(r => <ModelChip key={r} name={r} />) : <span className="text-xs text-zinc-600">None</span>}
          </div>
        </section>
      </div>

      <section>
        <h5 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Used by endpoints ({model.endpoints.length})</h5>
        {model.endpoints.length ? (
          model.endpoints.map(e => <EndpointChip key={e.key} endpoint={e.key} direct={e.direct} />)
        ) : (
          <span className="text-xs text-zinc-600">Not used by any endpoint</span>
        )}
      </section>
    </div>
  );

  const renderEndpoint = (endpoint: MapEndpoint) => (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 font-mono">
          <span className={`text-sm font-bold ${METHOD_COLORS[endpoint.method] || 'text-zinc-300'}`}>{endpoint.method}</span>
          <span className="text-sm text-zinc-100 break-all">{endpoint.path}</span>
          {endpoint.deprecated && <span className="text-[10px] px-1.5 rounded bg-amber-950 text-amber-300 border border-amber-800">deprecated</span>}
        </div>
        <p className="mt-1 text-xs text-zinc-300">{endpoint.name}</p>
        {endpoint.description && <p className="mt-1 text-xs text-zinc-500">{endpoint.description}</p>}
      </div>

      {endpoint.parameters.length > 0 && (
        <section>
          <h5 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Parameters</h5>
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {endpoint.parameters.map(p => (
                  <tr key={`${p.in}:${p.name}`}>
                    <td className="p-2 text-zinc-200">{p.name}{p.required && <span className="ml-1 text-rose-400">*</span>}</td>
                    <td className="p-2 text-zinc-500">{p.in}</td>
                    <td className="p-2 text-zinc-400">{p.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {endpoint.requestBody && (
        <section>
          <h5 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Request body</h5>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span className="font-mono">{endpoint.requestBody.contentType}</span>
            {endpoint.requestBody.models.length
              ? endpoint.requestBody.models.map(m => <ModelChip key={m} name={m} />)
              : <span className="font-mono">{endpoint.requestBody.type}</span>}
          </div>
        </section>
      )}

      <section>
        <h5 className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Responses</h5>
        <div className="space-y-1">
          {endpoint.responses.map(r => (
            <div key={r.status} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-14 font-mono font-semibold text-zinc-200">{r.status}</span>
              {r.models.length
                ? r.models.map(m => <ModelChip key={m} name={m} />)
                : r.type && <span className="font-mono text-zinc-400">{r.type}</span>}
              <span className="text-zinc-500">{r.description}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#15151a] border border-zinc-800 rounded-xl w-full max-w-6xl h-[85vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-zinc-100">API Map</h3>
              <p className="text-[11px] text-zinc-400">Endpoints and models from imported specifications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {specs.length > 0 && (
              <select
                value={specId}
                onChange={(e) => setSpecId(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none"
              >
                {specs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && <div className="m-3 p-2.5 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">{error}</div>}

        {!specs.length && !error ? (
          <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
            No specification imported yet. Use “Import API Spec” to add one.
          </div>
        ) : (
          <div className="flex-1 flex min-h-0">
            <div className="w-80 border-r border-zinc-800 flex flex-col min-h-0">
              <div className="p-2 space-y-2 border-b border-zinc-800">
                <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded px-2">
                  <Search className="w-3.5 h-3.5 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tab === 'endpoints' ? 'Search endpoints' : 'Search models'}
                    className="w-full bg-transparent py-1.5 text-xs text-zinc-200 focus:outline-none"
                  />
                </div>
                <div className="flex text-xs rounded bg-zinc-900 p-0.5">
                  {(['endpoints', 'models'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded ${tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      {t === 'endpoints' ? <Route className="w-3 h-3" /> : <Box className="w-3 h-3" />}
                      {t === 'endpoints' ? `Endpoints (${endpoints.length})` : `Models (${models.length})`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-1">
                {tab === 'endpoints'
                  ? groupedEndpoints.map(([tag, items]) => (
                      <div key={tag}>
                        <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-zinc-500">{tag}</div>
                        {items.map(e => (
                          <button
                            key={e.key}
                            onClick={() => goEndpoint(e.key)}
                            className={`w-full flex items-center gap-2 px-3 py-1 text-left text-[11px] font-mono ${selection?.kind === 'endpoint' && selection.id === e.key ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
                          >
                            <span className={`w-12 font-semibold ${METHOD_COLORS[e.method] || 'text-zinc-300'}`}>{e.method}</span>
                            <span className="truncate text-zinc-300">{e.path}</span>
                          </button>
                        ))}
                      </div>
                    ))
                  : models.map(m => (
                      <button
                        key={m.name}
                        onClick={() => goModel(m.name)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs font-mono ${selection?.kind === 'model' && selection.id === m.name ? 'bg-zinc-800' : 'hover:bg-zinc-900'}`}
                      >
                        <span className="truncate text-sky-300">{m.name}</span>
                        <span className="text-[10px] text-zinc-500">{m.fields.length} fields</span>
                      </button>
                    ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 select-text">
              {selectedModel ? renderModel(selectedModel) : selectedEndpoint ? renderEndpoint(selectedEndpoint) : (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                  Select an endpoint or model to explore its fields, references and usage.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useRef, useState } from 'react';
import { X, FileJson, Upload, ArrowRight, AlertTriangle, ShieldCheck, Folder } from 'lucide-react';
import { importOpenApi, previewOpenApi } from '../services/api';
import { CourierCollection, OpenApiPreview } from '../types';

interface OpenApiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (collection: CourierCollection) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  PATCH: 'text-violet-400',
  DELETE: 'text-rose-400',
};

export const OpenApiImportModal: React.FC<OpenApiImportModalProps> = ({ isOpen, onClose, onImported }) => {
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('');
  const [preview, setPreview] = useState<OpenApiPreview | null>(null);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const reset = () => {
    setContent('');
    setFilename('');
    setPreview(null);
    setName('');
    setBaseUrl('');
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const runPreview = async (text: string) => {
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const result = await previewOpenApi(text);
      setPreview(result);
      setName(result.info.title);
      setBaseUrl(result.servers[0]?.url || '');
    } catch (err: any) {
      setError(err.message || 'Failed to read the specification');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setContent(text);
    setFilename(file.name);
    await runPreview(text);
  };

  const handleImport = async () => {
    setBusy(true);
    setError('');
    try {
      const { collection } = await importOpenApi({ content, filename, name, baseUrl });
      onImported(collection);
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import the specification');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#15151a] border border-zinc-800 rounded-xl w-full max-w-3xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
              <FileJson className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-zinc-100">Import OpenAPI / Swagger</h3>
              <p className="text-[11px] text-zinc-400">OpenAPI 3.0/3.1 or Swagger 2.0 in JSON or YAML</p>
            </div>
          </div>
          <button onClick={close} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml,application/json,text/yaml"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200"
            >
              <Upload className="w-3.5 h-3.5" />
              Choose file
            </button>
            <span className="text-[11px] text-zinc-500 truncate">{filename || 'or paste the specification below'}</span>
          </div>

          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setPreview(null);
            }}
            placeholder={'openapi: 3.0.3\ninfo:\n  title: My API\n  version: 1.0.0\npaths: {}'}
            className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none select-text ${preview ? 'h-20' : 'h-44'}`}
            spellCheck={false}
          />

          {error && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">{error}</div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-400">Collection name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-zinc-400">Base URL ({'{{baseUrl}}'})</span>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.example.com"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">{preview.version}</span>
                <span className="text-zinc-400">{preview.counts.endpoints} endpoints</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">{preview.counts.models} models</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">{preview.counts.folders} folders</span>
                {preview.security.length > 0 && (
                  <span className="flex items-center gap-1 text-zinc-400">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    {preview.security.map(s => `${s.name} (${s.kind})`).join(', ')}
                  </span>
                )}
              </div>

              {preview.warnings.length > 0 && (
                <div className="p-2.5 rounded bg-amber-950/30 border border-amber-800/60 text-amber-200 text-[11px] space-y-1">
                  {preview.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-zinc-900 text-[11px] text-zinc-400 border-b border-zinc-800">
                  Collection preview — folders and requests that will be created
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-zinc-800/60 select-text">
                  {preview.folders.map(folder => (
                    <div key={folder.name} className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-200 font-medium">
                        <Folder className="w-3.5 h-3.5 text-zinc-500" />
                        {folder.name}
                        <span className="text-[10px] text-zinc-500">({folder.count})</span>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {preview.endpoints.filter(e => e.tag === folder.name).map(e => (
                          <div key={`${e.method} ${e.path}`} className="flex items-center gap-2 pl-5 text-[11px] font-mono">
                            <span className={`w-12 font-semibold ${METHOD_COLORS[e.method] || 'text-zinc-300'}`}>{e.method}</span>
                            <span className={`truncate ${e.deprecated ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>{e.path}</span>
                            {e.hasBody && <span className="text-[9px] text-zinc-500">body</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-zinc-800 bg-[#121216] flex items-center justify-end gap-2 text-xs">
          <button onClick={close} className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
            Cancel
          </button>
          {!preview ? (
            <button
              onClick={() => runPreview(content)}
              disabled={!content.trim() || busy}
              className="px-4 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white font-semibold"
            >
              {busy ? 'Reading…' : 'Preview'}
            </button>
          ) : (
            <button
              onClick={handleImport}
              disabled={busy || !preview.counts.endpoints}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold shadow-sm transition-colors"
            >
              <span>{busy ? 'Importing…' : `Import ${preview.counts.endpoints} requests`}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

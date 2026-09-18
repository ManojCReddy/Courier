import React, { useState } from 'react';
import { X, Terminal, ArrowRight } from 'lucide-react';
import { parseCurlCommand } from '../services/api';
import { CourierRequest } from '../types';

interface CurlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (parsed: Partial<CourierRequest>) => void;
}

export const CurlImportModal: React.FC<CurlImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [curlText, setCurlText] = useState('');
  const [error, setError] = useState('');
  const [isParsing, setIsParsing] = useState(false);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!curlText.trim()) return;
    setIsParsing(true);
    setError('');

    try {
      const parsed = await parseCurlCommand(curlText);
      onImport(parsed);
      onClose();
      setCurlText('');
    } catch (err: any) {
      setError(err.message || 'Failed to parse cURL command');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#15151a] border border-zinc-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-zinc-100">Import cURL Command</h3>
              <p className="text-[11px] text-zinc-400">Paste any raw cURL snippet to generate a request</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <textarea
            value={curlText}
            onChange={(e) => setCurlText(e.target.value)}
            placeholder={`curl -X POST "https://api.example.com/v1/auth/login" \\\n  -H "Content-Type: application/json" \\\n  -d '{"email": "dev@example.com", "password": "secret"}'`}
            className="w-full h-44 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed select-text"
            spellCheck={false}
          />

          {error && (
            <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800 bg-[#121216] flex items-center justify-end gap-2 text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleImport}
            disabled={!curlText.trim() || isParsing}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold shadow-sm transition-colors"
          >
            <span>Import into Workbench</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};


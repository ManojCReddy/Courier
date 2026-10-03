import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { CourierRequest } from '../types';
import {
  SnippetLanguage,
  SNIPPET_OPTIONS,
  generateCodeSnippet
} from '../services/snippetGenerator';

interface CodeSnippetPanelProps {
  isOpen: boolean;
  onClose: () => void;
  request: CourierRequest | null;
  variables?: Record<string, string>;
}

export const CodeSnippetPanel: React.FC<CodeSnippetPanelProps> = ({
  isOpen,
  onClose,
  request,
  variables = {},
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<SnippetLanguage>('curl');
  const [copied, setCopied] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number>(480);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(480);

  // Drag-to-resize listener
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.min(Math.floor(window.innerWidth * 0.85), Math.max(340, startWidthRef.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  // Generate code snippet reactively whenever request, variables, or language changes
  const snippetCode = useMemo(() => {
    if (!request) return "curl --location ''";
    return generateCodeSnippet(selectedLanguage, request, variables);
  }, [selectedLanguage, request, variables]);

  const lines = useMemo(() => {
    return snippetCode.split('\n');
  }, [snippetCode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippetCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code snippet to clipboard', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute top-0 right-0 bottom-0 h-full flex flex-col border-l border-zinc-800 bg-[#0e0e11] text-zinc-200 shadow-[-16px_0_40px_rgba(0,0,0,0.7)] z-40 select-none animate-in fade-in slide-in-from-right duration-200"
      style={{ width: `${panelWidth}px`, maxWidth: '95vw', background: 'var(--app-surface, #0e0e11)' }}
    >
      {/* Drag-to-resize Handle on Left Border */}
      <div
        onMouseDown={handleStartResize}
        className="absolute top-0 left-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/60 active:bg-emerald-500 transition-colors z-50 -ml-0.5"
        title="Drag to resize panel"
      />

      {/* 1. Header (Postman style: </> Code snippet + Close) */}
      <div className="h-12 px-4 border-b border-zinc-800/90 flex items-center justify-between bg-[#121216] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center text-emerald-400 bg-emerald-950/50 border border-emerald-800/40">
            <span className="font-mono font-bold text-xs">&lt;/&gt;</span>
          </div>
          <span className="font-semibold text-xs tracking-wide text-zinc-100">Code snippet</span>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          title="Close snippet panel"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Control Toolbar: Language dropdown & Copy button (No settings icon, clean & visual) */}
      <div className="p-3 border-b border-zinc-800/80 bg-[#141419] flex items-center justify-between gap-3 flex-shrink-0">
        {/* Language Selector Dropdown */}
        <div className="relative flex-1 max-w-[240px]">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value as SnippetLanguage)}
            className="w-full appearance-none bg-[#1c1c22] hover:bg-[#22222a] border border-zinc-700/80 text-zinc-200 text-xs font-semibold px-3 py-1.5 rounded-md focus:outline-none focus:border-emerald-500 cursor-pointer pr-8 transition-colors"
          >
            {SNIPPET_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-[#18181e] text-zinc-200">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-zinc-400">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
            copied
              ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300'
              : 'bg-[#1c1c22] hover:bg-[#25252e] border-zinc-700/80 text-zinc-300 hover:text-zinc-100'
          }`}
          title="Copy snippet to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* 3. Visual Code Display (Line numbers + Monospace Code Viewer) */}
      <div className="flex-1 overflow-auto bg-[#0a0a0d] flex font-mono text-xs select-text">
        {/* Line Numbers Gutter */}
        <div className="py-3 px-2 text-right select-none bg-[#09090b] border-r border-zinc-800/70 text-zinc-600 font-mono min-w-[38px] flex-shrink-0">
          {lines.map((_, index) => (
            <div key={index} className="leading-5 h-5 text-[11px]">
              {index + 1}
            </div>
          ))}
        </div>

        {/* Code Content */}
        <div className="flex-1 p-3 overflow-x-auto min-w-0">
          <pre className="m-0 font-mono text-[12px] leading-5 text-zinc-200 whitespace-pre">
            {lines.map((line, idx) => (
              <div key={idx} className="leading-5 h-5 whitespace-pre">
                {renderHighlightedLine(line, selectedLanguage)}
              </div>
            ))}
          </pre>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 border-t border-zinc-800/80 bg-[#121216] text-[10px] text-zinc-500 flex items-center justify-between flex-shrink-0">
        <span>Visual snippet updates in real-time</span>
        <span className="font-mono text-[9px] uppercase px-1 rounded bg-zinc-800/60 text-zinc-400">
          {selectedLanguage}
        </span>
      </div>
    </div>
  );
};

/**
 * Syntax-friendly styling for snippet lines.
 */
function renderHighlightedLine(line: string, language: SnippetLanguage) {
  if (!line) return <span>&nbsp;</span>;

  if (language === 'curl') {
    if (line.trim().startsWith('curl')) {
      const match = line.match(/^(\s*curl\s+--location)(.*)$/);
      if (match) {
        return (
          <span>
            <span className="text-emerald-400 font-bold">curl </span>
            <span className="text-cyan-400">--location </span>
            <span className="text-amber-300">{match[2]}</span>
          </span>
        );
      }
      return <span className="text-emerald-400">{line}</span>;
    }

    if (line.trim().startsWith('--header')) {
      return (
        <span>
          <span className="text-purple-400">  --header </span>
          <span className="text-sky-300">{line.trim().replace('--header', '')}</span>
        </span>
      );
    }

    if (line.trim().startsWith('--data') || line.trim().startsWith('--data-urlencode')) {
      const isUrlEncode = line.trim().startsWith('--data-urlencode');
      const prefix = isUrlEncode ? '  --data-urlencode ' : '  --data ';
      const rest = line.trim().replace(isUrlEncode ? '--data-urlencode' : '--data', '');
      return (
        <span>
          <span className="text-amber-400">{prefix}</span>
          <span className="text-emerald-200">{rest}</span>
        </span>
      );
    }

    if (line.endsWith('\\')) {
      return (
        <span>
          <span className="text-zinc-200">{line.slice(0, -1)}</span>
          <span className="text-zinc-600">\</span>
        </span>
      );
    }
  }

  return <span className="text-zinc-200">{line}</span>;
}

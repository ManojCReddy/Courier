import React from 'react';
import { Play, Sparkles, Sliders, Terminal, Globe, Plus, ShieldCheck } from 'lucide-react';
import { Environment } from '../types';

interface HeaderProps {
  environments: Environment[];
  selectedEnvId: string;
  onSelectEnv: (id: string) => void;
  onOpenEnvModal: () => void;
  onOpenCurlModal: () => void;
  onOpenSuiteRunner: () => void;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  environments,
  selectedEnvId,
  onSelectEnv,
  onOpenEnvModal,
  onOpenCurlModal,
  onOpenSuiteRunner,
  copilotOpen,
  onToggleCopilot,
}) => {
  return (
    <header className="h-14 border-b border-zinc-800 bg-[#121215] px-4 flex items-center justify-between select-none">
      {/* Brand & Air-Gapped Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-inner">
            <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </div>
          <span className="font-bold tracking-wider text-base text-zinc-100 flex items-center gap-1.5">
            COURIER
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">v0.1</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[11px] text-emerald-400/90 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Local-First • 100% Air-Gapped</span>
        </div>
      </div>

      {/* Center Actions: Environment Selector */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-zinc-900 border border-zinc-700/80 rounded-lg p-1 text-xs">
          <Globe className="w-3.5 h-3.5 text-zinc-400 ml-1.5 mr-1" />
          <select
            value={selectedEnvId}
            onChange={(e) => onSelectEnv(e.target.value)}
            className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer pr-3 py-0.5 text-xs font-medium"
          >
            <option value="" className="bg-zinc-900 text-zinc-400">No Environment</option>
            {environments.map((env) => (
              <option key={env.id} value={env.id} className="bg-zinc-900 text-zinc-200">
                {env.name}
              </option>
            ))}
          </select>

          <button
            onClick={onOpenEnvModal}
            title="Manage Environments & Variables"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCurlModal}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 transition-colors"
          title="Import raw cURL command"
        >
          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          <span>Import cURL</span>
        </button>

        <button
          onClick={onOpenSuiteRunner}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-emerald-900/60 transition-colors"
          title="Run collection test suite"
        >
          <Play className="w-3.5 h-3.5 fill-emerald-400/20 text-emerald-400" />
          <span>Run Suite</span>
        </button>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

        {/* Courier Copilot Toggle Button */}
        <button
          onClick={onToggleCopilot}
          className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all shadow-sm ${
            copilotOpen
              ? 'bg-purple-600 text-white border-purple-500 shadow-purple-900/30'
              : 'bg-gradient-to-r from-purple-950/50 to-indigo-950/50 hover:from-purple-900/60 hover:to-indigo-900/60 text-purple-300 border-purple-800/60 hover:border-purple-600'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${copilotOpen ? 'animate-spin text-white' : 'text-purple-400'}`} />
          <span>Courier Copilot</span>
          <span className="text-[9px] bg-purple-500/20 text-purple-200 px-1 py-0.2 rounded border border-purple-400/30">AI</span>
        </button>
      </div>
    </header>
  );
};


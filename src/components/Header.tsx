import React from 'react';
import { Play, Sliders, Globe, ShieldCheck, Settings, Columns, Rows, Minus, Square, X } from 'lucide-react';
import courierLogo from '../../assets/courier-icon.png';
import { Environment, AppSettings } from '../types';

interface HeaderProps {
  environments: Environment[];
  selectedEnvId: string;
  onSelectEnv: (id: string) => void;
  onOpenEnvModal: () => void;
  onOpenCurlModal: () => void;
  onOpenSuiteRunner: () => void;
  onOpenSettingsModal: () => void;
  layout: AppSettings['layout'];
  onToggleLayout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  environments,
  selectedEnvId,
  onSelectEnv,
  onOpenEnvModal,
  onOpenCurlModal,
  onOpenSuiteRunner,
  onOpenSettingsModal,
  layout,
  onToggleLayout,
}) => {
  const handleWindowAction = (action: 'minimize' | 'maximize' | 'close') => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      (window as any).electronAPI[action]();
    }
  };

  return (
    <header className="relative h-14 border-b border-zinc-800 bg-[#121215] px-4 flex items-center justify-between select-none">

      {/* Brand & Air-Gapped Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-900/50 ring-1 ring-emerald-800/30">
            <img src={courierLogo} alt="Courier logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-black tracking-[0.18em] text-[15px] text-zinc-100 flex items-center gap-1.5">
            COURIER
            <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">v0.2.3</span>
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

      {/* Keep space clear for the absolutely-pinned window controls. */}
      <div className="flex items-center gap-2 pr-32">
        <button
          onClick={onOpenSuiteRunner}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-emerald-900/60 transition-colors"
          title="Run collection test suite"
        >
          <Play className="w-3.5 h-3.5 fill-emerald-400/20 text-emerald-400" />
          <span>Run Suite</span>
        </button>

        <button
          onClick={onToggleLayout}
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700/80 transition-colors"
          title={layout === 'horizontal' ? 'Switch to Stacked View (Response Underneath)' : 'Switch to Side-by-Side View'}
        >
          {layout === 'horizontal' ? <Rows className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={onOpenSettingsModal}
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700/80 transition-colors"
          title="Preferences & Settings (SSL, Autosave, Timeout)"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        <div className="h-4 w-[1px] bg-zinc-800 mx-1" />

      </div>

      {/* Window Controls — absolute top-right, never overlaps other content */}
      <div className="absolute top-0 right-0 h-full flex items-center pr-4">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleWindowAction('minimize')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleWindowAction('maximize')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            title="Maximize"
            aria-label="Maximize"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleWindowAction('close')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-300 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </header>
  );
};

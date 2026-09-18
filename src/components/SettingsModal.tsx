import React from 'react';
import { X, ShieldAlert, Save, Clock, Layout, HelpCircle, Bot, Sparkles, Check } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#15151a] border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-[#121216]">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-zinc-100">Preferences &amp; Settings</h3>
            <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">Courier</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs">
          {/* General & Network Section */}
          <div className="space-y-4">
            <h4 className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px] pb-1 border-b border-zinc-800 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              Network &amp; Security
            </h4>

            {/* SSL Verification */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="space-y-1">
                <div className="font-medium text-zinc-200">SSL Certificate Verification</div>
                <div className="text-[11px] text-zinc-400">
                  When disabled, Courier allows requests to endpoints with self-signed, invalid, or intranet SSL/TLS certificates.
                </div>
              </div>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, disableSslVerification: !settings.disableSslVerification })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.disableSslVerification ? 'bg-amber-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.disableSslVerification ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Autosave */}
            <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="space-y-1">
                <div className="font-medium text-zinc-200">Auto-Save Requests</div>
                <div className="text-[11px] text-zinc-400">
                  Automatically persist changes to your local collection files on disk without needing to click Save.
                </div>
              </div>

              <button
                type="button"
                onClick={() => onUpdateSettings({ ...settings, autoSave: !settings.autoSave })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.autoSave ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    settings.autoSave ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Request Timeout */}
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="space-y-1">
                <div className="font-medium text-zinc-200">Default Request Timeout (ms)</div>
                <div className="text-[11px] text-zinc-400">Maximum time to wait for API responses before timing out.</div>
              </div>

              <input
                type="number"
                value={settings.defaultTimeoutMs}
                onChange={(e) => onUpdateSettings({ ...settings, defaultTimeoutMs: parseInt(e.target.value, 10) || 30000 })}
                className="w-28 bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-zinc-200 font-mono text-right"
              />
            </div>
          </div>

          {/* Layout Preference */}
          <div className="space-y-3">
            <h4 className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px] pb-1 border-b border-zinc-800 flex items-center gap-1.5">
              <Layout className="w-3.5 h-3.5 text-blue-400" />
              Workbench Layout
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => onUpdateSettings({ ...settings, layout: 'horizontal' })}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  settings.layout === 'horizontal'
                    ? 'border-emerald-500 bg-emerald-950/20 text-zinc-100'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between font-medium mb-1">
                  <span>Side-by-Side (Columns)</span>
                  {settings.layout === 'horizontal' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-zinc-500">Request on left, Response on right (Wide screen layout)</p>
              </div>

              <div
                onClick={() => onUpdateSettings({ ...settings, layout: 'vertical' })}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  settings.layout === 'vertical'
                    ? 'border-emerald-500 bg-emerald-950/20 text-zinc-100'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between font-medium mb-1">
                  <span>Stacked (Postman style)</span>
                  {settings.layout === 'vertical' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-zinc-500">Request on top, Response underneath</p>
              </div>
            </div>
          </div>

          {/* AI / Copilot Login & Privacy Clarification */}
          <div className="space-y-3">
            <h4 className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px] pb-1 border-b border-zinc-800 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              AI Chatbox &amp; Account Privacy
            </h4>

            <div className="p-3.5 rounded-lg bg-purple-950/20 border border-purple-900/40 space-y-2 text-[11px] text-purple-200">
              <div className="font-semibold text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Do customers need to log into an account to use the AI?
              </div>
              <p className="text-zinc-300 leading-relaxed">
                <strong>No login is required!</strong> Courier never requires customers to create a Courier cloud account.
              </p>
              <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                <li><strong className="text-zinc-300">Offline Smart Engine:</strong> Works immediately out of the box with zero keys, zero accounts, and zero internet.</li>
                <li><strong className="text-zinc-300">Local Ollama:</strong> Runs 100% offline on your computer (e.g. Llama 3) with zero data leaving your network.</li>
                <li><strong className="text-zinc-300">Google Gemini Mode:</strong> You can optionally supply your own API key directly. No Courier sign-in or middleman server.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-[#121216] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};


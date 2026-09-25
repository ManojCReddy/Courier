import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Settings,
  ShieldCheck,
  Bot,
  User,
  Check,
  Wand2,
  Stethoscope,
  Terminal,
  Server,
  Zap,
  Minimize2,
  Maximize2,
  ChevronRight,
} from 'lucide-react';
import { CopilotMessage, CopilotConfig, CourierRequest, HttpResponse, TestAssertion } from '../types';
import { callCopilot } from '../services/api';

type PanelMode = 'closed' | 'minimized' | 'normal' | 'maximized';

interface CopilotDrawerProps {
  isOpen: boolean;
  panelMode: PanelMode;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  currentRequest: CourierRequest | null;
  currentResponse: HttpResponse | null;
  onApplyRequest: (requestPatch: Partial<CourierRequest>) => void;
  onApplyAssertions: (assertions: TestAssertion[]) => void;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  panelMode,
  onClose,
  onMinimize,
  onMaximize,
  currentRequest,
  currentResponse,
  onApplyRequest,
  onApplyAssertions,
}) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 **Welcome to Chetan!**

I am your local-first AI assistant for API development and testing.

**How I can help:**
- ⚡ **"Create a POST request for user signup with email, password, and role"**
- 🧪 **"Generate assertions for the latest response"**
- 🩺 **"Why did I get a 401 or 422 error and how do I fix it?"**
- 🔄 **"Explain how to use dynamic variables like {{$guid}}"**

*Enterprise Security Note*: Connect me to **Local Ollama** (\`http://localhost:11434\`) for 100% offline, air-gapped AI that never leaves your machine!`,
      timestamp: new Date().toLocaleTimeString(),
      providerUsed: 'Chetan'
    }
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings State (persisted in localStorage)
  const [config, setConfig] = useState<CopilotConfig>(() => {
    const saved = localStorage.getItem('courier_copilot_config');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      provider: 'local_ollama',
      ollamaUrl: 'http://127.0.0.1:11434',
      ollamaModel: 'qwen2.5-coder:7b',
      geminiKey: '',
      geminiModel: 'gemini-2.5-flash',
      openaiKey: '',
      openaiModel: 'gpt-4o-mini',
    };
  });

  const [ollamaTestStatus, setOllamaTestStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isTestingOllama, setIsTestingOllama] = useState(false);

  const handleTestOllama = async () => {
    setIsTestingOllama(true);
    setOllamaTestStatus(null);
    try {
      const url = config.ollamaUrl || 'http://127.0.0.1:11434';
      const targetModel = config.ollamaModel || 'qwen2.5-coder:7b';
      const res = await fetch(`${url}/api/tags`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const models = (data.models || []).map((m: any) => m.name);
      const hasModel = models.some((m: string) => m.includes(targetModel) || targetModel.includes(m));
      if (hasModel) {
        setOllamaTestStatus({ ok: true, msg: `Verified: ${targetModel} responded cleanly` });
      } else {
        setOllamaTestStatus({ ok: true, msg: `Connected. Available: ${models.join(', ') || 'none'}` });
      }
    } catch (err: any) {
      setOllamaTestStatus({ ok: false, msg: `Connection failed: ${err.message}` });
    } finally {
      setIsTestingOllama(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveConfig = (newConfig: CopilotConfig) => {
    setConfig(newConfig);
    localStorage.setItem('courier_copilot_config', JSON.stringify(newConfig));
  };

  const handleSendMessage = async (text: string, mode: string = 'chat') => {
    if (!text.trim() || isLoading) return;

    const userMsg: CopilotMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await callCopilot({
        messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        mode,
        context: {
          currentRequest: currentRequest || undefined,
          currentResponse: currentResponse || undefined,
        },
        config,
      });

      const assistantMsg: CopilotMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toLocaleTimeString(),
        providerUsed: response.providerUsed,
        suggestions: response.suggestions,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Error contacting Chetan service: ${err.message}`,
          timestamp: new Date().toLocaleTimeString(),
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Action triggers
  const handleQuickAction = (mode: string, label: string) => {
    handleSendMessage(label, mode);
  };

  if (!isOpen) return null;

  // ── Minimized strip view ──────────────────────────────────────────────────
  if (panelMode === 'minimized') {
    return (
      <div className="h-full w-12 bg-[#121216] border-l border-zinc-800 flex flex-col items-center py-3 gap-3 select-none">
        <button
          onClick={onMinimize}
          className="p-2 rounded-lg hover:bg-zinc-800 text-purple-400 hover:text-purple-300 transition-colors"
          title="Expand Chetan AI"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
          <Sparkles className="w-4 h-4" />
        </div>
        <button
          onClick={onClose}
          className="mt-auto p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          title="Close Chetan AI"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ── Full panel view (normal / maximized) ─────────────────────────────────
  return (
    <div className="h-full w-full bg-[#121216] border-l border-zinc-800 shadow-2xl flex flex-col select-none">
      {/* Header */}
      <div className="h-14 border-b border-zinc-800 px-4 flex items-center justify-between bg-[#15151a] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-zinc-100">Chetan AI</span>
              <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-1 py-0.2 rounded font-semibold">
                AI Assistant
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Air-Gapped &amp; Local-First Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Configure AI Provider (Ollama / Gemini / OpenAI)"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Minimize → icon strip */}
          <button
            onClick={onMinimize}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Minimize to icon strip"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          {/* Maximize / Restore */}
          <button
            onClick={onMaximize}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title={panelMode === 'maximized' ? 'Restore width' : 'Expand to 50% width'}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Close Chetan AI"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Flyout */}
      {showSettings && (
        <div className="p-4 border-b border-zinc-800 bg-[#17171d] text-xs space-y-3">
          <div className="flex items-center justify-between font-semibold text-zinc-200">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-purple-400" />
              AI Provider Settings
            </span>
            <button
              onClick={() => setShowSettings(false)}
              className="text-zinc-400 hover:text-zinc-200 text-[11px]"
            >
              Close
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-zinc-400 text-[11px]">Provider:</label>
            <select
              value={config.provider}
              onChange={(e) => saveConfig({ ...config, provider: e.target.value as any })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none font-medium"
            >
              <option value="gemini">Google AI Mode (Gemini 2.5 Flash / Pro)</option>
              <option value="local_ollama">Local Ollama (100% Offline &amp; Air-Gapped)</option>
              <option value="auto">Auto (Gemini -&gt; Local Ollama -&gt; Offline Engine)</option>
              <option value="openai">OpenAI (ChatGPT BYOK)</option>
            </select>
          </div>

          {config.provider === 'gemini' && (
            <div className="space-y-2">
              <div>
                <label className="text-zinc-400 text-[11px]">Gemini Model:</label>
                <select
                  value={config.geminiModel || 'gemini-2.5-flash'}
                  onChange={(e) => saveConfig({ ...config, geminiModel: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-zinc-200 focus:outline-none font-mono text-[11px]"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Fastest &amp; Recommended)</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Deep Reasoning)</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400 text-[11px] flex items-center justify-between">
                  <span>Gemini API Key:</span>
                  <span className="text-[10px] text-purple-400 font-normal">Optional if set in .env</span>
                </label>
                <input
                  type="password"
                  value={config.geminiKey}
                  onChange={(e) => saveConfig({ ...config, geminiKey: e.target.value })}
                  placeholder="AIzaSy... (or leave empty if GEMINI_API_KEY in env)"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 font-mono text-[11px]"
                />
              </div>
            </div>
          )}

          {(config.provider === 'local_ollama' || config.provider === 'auto') && (
            <div className="space-y-2 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="text-zinc-300 font-medium text-[11px]">Ollama Local Endpoint:</label>
                <button
                  type="button"
                  onClick={handleTestOllama}
                  disabled={isTestingOllama}
                  className="px-2 py-0.5 rounded text-[10px] bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border border-purple-700/50 transition-colors disabled:opacity-50"
                >
                  {isTestingOllama ? 'Connecting...' : 'Test Connection'}
                </button>
              </div>

              <input
                type="text"
                value={config.ollamaUrl || 'http://127.0.0.1:11434'}
                onChange={(e) => saveConfig({ ...config, ollamaUrl: e.target.value })}
                placeholder="http://127.0.0.1:11434"
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 font-mono text-[11px]"
              />

              <div>
                <label className="text-zinc-400 text-[10px]">Ollama Model:</label>
                <div className="flex gap-1.5 mt-0.5">
                  <input
                    type="text"
                    value={config.ollamaModel || 'qwen2.5-coder:7b'}
                    onChange={(e) => saveConfig({ ...config, ollamaModel: e.target.value })}
                    placeholder="qwen2.5-coder:7b"
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 font-mono text-[11px]"
                  />
                  <select
                    value={config.ollamaModel || 'qwen2.5-coder:7b'}
                    onChange={(e) => saveConfig({ ...config, ollamaModel: e.target.value })}
                    className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 text-[11px]"
                  >
                    <option value="qwen2.5-coder:7b">qwen2.5-coder:7b</option>
                    <option value="llama3">llama3</option>
                    <option value="mistral">mistral</option>
                    <option value="deepseek-coder">deepseek-coder</option>
                  </select>
                </div>
              </div>

              {ollamaTestStatus && (
                <div className={`text-[10px] px-2 py-1 rounded flex items-center gap-1.5 ${
                  ollamaTestStatus.ok
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                    : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${ollamaTestStatus.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span>{ollamaTestStatus.msg}</span>
                </div>
              )}
            </div>
          )}

          {config.provider === 'openai' && (
            <div>
              <label className="text-zinc-400 text-[11px]">OpenAI API Key:</label>
              <input
                type="password"
                value={config.openaiKey}
                onChange={(e) => saveConfig({ ...config, openaiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 font-mono text-[11px]"
              />
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/90 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero telemetry: Keys & payloads stay strictly local.</span>
          </div>
        </div>
      )}

      {/* Quick Action Chips */}
      <div className="p-2 border-b border-zinc-800 bg-[#101014] flex items-center gap-1.5 overflow-x-auto text-[11px]">
        <button
          onClick={() => handleQuickAction('generate_request', 'Create a POST request for user registration')}
          className="flex-shrink-0 flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-1 rounded-full transition-colors"
        >
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Gen Request</span>
        </button>

        {currentResponse && (
          <button
            onClick={() => handleQuickAction('generate_tests', 'Generate test assertions for the current response')}
            className="flex-shrink-0 flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-purple-300 px-2 py-1 rounded-full transition-colors"
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Gen Tests</span>
          </button>
        )}

        {currentResponse && currentResponse.status >= 400 && (
          <button
            onClick={() => handleQuickAction('diagnose_error', `Diagnose why status ${currentResponse.status} occurred`)}
            className="flex-shrink-0 flex items-center gap-1 bg-amber-950/40 hover:bg-amber-900/40 border border-amber-800/60 text-amber-300 px-2 py-1 rounded-full transition-colors"
          >
            <Stethoscope className="w-3 h-3 text-amber-400" />
            <span>Diagnose Error</span>
          </button>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs select-text">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              m.role === 'user'
                ? 'bg-zinc-700 text-zinc-200'
                : 'bg-purple-600/30 border border-purple-500/50 text-purple-300'
            }`}>
              {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div className={`max-w-[85%] rounded-xl p-3 leading-relaxed shadow-sm ${
              m.role === 'user'
                ? 'bg-zinc-800 text-zinc-100'
                : 'bg-zinc-900/80 border border-zinc-800 text-zinc-200'
            }`}>
              <div className="whitespace-pre-wrap font-sans text-xs">
                {m.content}
              </div>

              {/* Suggestions Card (Apply to request / Apply assertions) */}
              {m.suggestions && (
                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 space-y-2 select-none">
                  {m.suggestions.request && (
                    <button
                      onClick={() => onApplyRequest(m.suggestions!.request!)}
                      className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-colors shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply to Request Workbench</span>
                    </button>
                  )}

                  {m.suggestions.assertions && (
                    <button
                      onClick={() => onApplyAssertions(m.suggestions!.assertions!)}
                      className="w-full flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition-colors shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Apply {m.suggestions.assertions.length} Assertions to Request</span>
                    </button>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500 select-none">
                <span>{m.timestamp}</span>
                {m.providerUsed && <span className="italic">{m.providerUsed}</span>}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2.5 items-center text-xs text-zinc-400 italic bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/60">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span>Chetan is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-3 border-t border-zinc-800 bg-[#15151a]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Chetan or generate request/tests..."
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
            title="Send to Chetan"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};


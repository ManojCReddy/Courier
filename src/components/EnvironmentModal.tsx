import React, { useState } from 'react';
import { X, Plus, Trash2, Eye, EyeOff, Globe, Save } from 'lucide-react';
import { Environment, EnvironmentVariable } from '../types';

interface EnvironmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  environments: Environment[];
  onSaveEnvironment: (env: Environment) => void;
  onDeleteEnvironment: (id: string) => void;
}

export const EnvironmentModal: React.FC<EnvironmentModalProps> = ({
  isOpen,
  onClose,
  environments,
  onSaveEnvironment,
  onDeleteEnvironment,
}) => {
  const [selectedEnvId, setSelectedEnvId] = useState<string>(
    environments[0]?.id || ''
  );
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const activeEnv = environments.find(e => e.id === selectedEnvId) || environments[0];

  if (!isOpen) return null;

  const handleAddVariable = () => {
    if (!activeEnv) return;
    const newVar: EnvironmentVariable = {
      key: '',
      value: '',
      enabled: true,
      isSecret: false,
    };
    onSaveEnvironment({
      ...activeEnv,
      variables: [...activeEnv.variables, newVar],
    });
  };

  const handleUpdateVar = (idx: number, patch: Partial<EnvironmentVariable>) => {
    if (!activeEnv) return;
    const vars = [...activeEnv.variables];
    vars[idx] = { ...vars[idx], ...patch };
    onSaveEnvironment({
      ...activeEnv,
      variables: vars,
    });
  };

  const handleRemoveVar = (idx: number) => {
    if (!activeEnv) return;
    const vars = activeEnv.variables.filter((_, i) => i !== idx);
    onSaveEnvironment({
      ...activeEnv,
      variables: vars,
    });
  };

  const handleCreateNewEnvironment = () => {
    const name = prompt('Enter new environment name (e.g. Staging, Production):');
    if (!name) return;
    const newEnv: Environment = {
      id: `env-${Date.now()}`,
      name,
      variables: [
        { key: 'baseUrl', value: 'https://api.example.com', enabled: true, isSecret: false }
      ],
    };
    onSaveEnvironment(newEnv);
    setSelectedEnvId(newEnv.id);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#15151a] border border-zinc-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-[#121216]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-300">
              <Globe className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-xs text-zinc-100">Environment &amp; Variable Manager</h3>
              <p className="text-[11px] text-zinc-400">Stored locally in ./courier-data/environments/</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Layout: Left Env list, Right variables table */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Environments List */}
          <div className="w-48 border-r border-zinc-800 bg-[#121215] p-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
                Environments
              </div>
              {environments.map((env) => (
                <div
                  key={env.id}
                  onClick={() => setSelectedEnvId(env.id)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    activeEnv?.id === env.id
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate">{env.name}</span>
                  {environments.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete environment "${env.name}"?`)) {
                          onDeleteEnvironment(env.id);
                        }
                      }}
                      className="text-zinc-500 hover:text-rose-400 p-0.5 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={handleCreateNewEnvironment}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-zinc-900 border border-zinc-800 hover:border-emerald-800/60 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Environment</span>
            </button>
          </div>

          {/* Right: Variables Table */}
          <div className="flex-1 flex flex-col p-4 bg-[#141418] overflow-hidden">
            {activeEnv ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-xs text-zinc-100">{activeEnv.name} Variables</h4>
                    <p className="text-[11px] text-zinc-400">Use in requests via <code className="text-emerald-400 font-mono">{'{{key}}'}</code> syntax</p>
                  </div>

                  <button
                    onClick={handleAddVariable}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Variable
                  </button>
                </div>

                <div className="flex-1 border border-zinc-800 rounded-lg overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 sticky top-0">
                      <tr>
                        <th className="p-2 w-8 text-center"></th>
                        <th className="p-2 w-1/3">Variable</th>
                        <th className="p-2 w-1/2">Value</th>
                        <th className="p-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40 font-mono">
                      {activeEnv.variables.map((v, idx) => {
                        const isMasked = v.isSecret && !showSecrets[`${activeEnv.id}-${idx}`];
                        return (
                          <tr key={idx} className="hover:bg-zinc-900/40">
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={v.enabled}
                                onChange={(e) => handleUpdateVar(idx, { enabled: e.target.checked })}
                                className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={v.key}
                                onChange={(e) => handleUpdateVar(idx, { key: e.target.value })}
                                placeholder="variableName"
                                className="w-full bg-transparent text-zinc-200 focus:outline-none"
                              />
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type={isMasked ? 'password' : 'text'}
                                  value={v.value}
                                  onChange={(e) => handleUpdateVar(idx, { value: e.target.value })}
                                  placeholder="value"
                                  className="w-full bg-transparent text-zinc-200 focus:outline-none"
                                />
                                {v.isSecret && (
                                  <button
                                    onClick={() =>
                                      setShowSecrets(prev => ({
                                        ...prev,
                                        [`${activeEnv.id}-${idx}`]: !prev[`${activeEnv.id}-${idx}`]
                                      }))
                                    }
                                    className="text-zinc-500 hover:text-zinc-300 p-0.5"
                                  >
                                    {isMasked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => handleRemoveVar(idx)}
                                className="text-zinc-500 hover:text-rose-400 p-1 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {activeEnv.variables.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-zinc-500 italic">
                            No variables defined. Click "+ Add Variable" to add baseUrl, token, etc.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-zinc-500 text-xs italic">
                No environment selected.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


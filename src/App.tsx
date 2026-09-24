import React, { useState, useEffect, useRef } from 'react';
import {
  fetchCollections,
  saveCollection,
  deleteCollection,
  fetchEnvironments,
  saveEnvironment,
  deleteEnvironment,
  executeRequest,
} from './services/api';
import { CourierCollection, CourierRequest, CourierFolder, Environment, HttpResponse, TestAssertion, AppSettings } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { RequestTabs } from './components/RequestTabs';
import { RequestPanel } from './components/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel';
import { CopilotDrawer } from './components/CopilotDrawer';
import { CurlImportModal } from './components/CurlImportModal';
import { EnvironmentModal } from './components/EnvironmentModal';
import { SuiteRunnerModal } from './components/SuiteRunnerModal';
import { SettingsModal } from './components/SettingsModal';

export const App: React.FC = () => {
  // Collections & Requests state
  const [collections, setCollections] = useState<CourierCollection[]>([]);
  const [openTabs, setOpenTabs] = useState<Array<{ collectionId: string; request: CourierRequest }>>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  // Response state
  const [currentResponse, setCurrentResponse] = useState<HttpResponse | null>(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState(false);

  // Environments state
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');

  // Settings state (persisted in localStorage)
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('courier_app_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      disableSslVerification: false,
      autoSave: false,
      defaultTimeoutMs: 30000,
      layout: 'horizontal',
    };
  });

  // Sidebar resize state
  const [sidebarWidth, setSidebarWidth] = useState<number>(280);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Request/response workspace divider state
  const [requestPaneSize, setRequestPaneSize] = useState<number>(520);
  const requestPaneResizeRef = useRef<{ startX: number; startSize: number } | null>(null);
  const requestPaneResizeYRef = useRef<{ startY: number; startSize: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!sidebarResizeRef.current && !requestPaneResizeRef.current && !requestPaneResizeYRef.current) return;

      if (sidebarResizeRef.current) {
        const nextWidth = sidebarResizeRef.current.startWidth + (event.clientX - sidebarResizeRef.current.startX);
        setSidebarWidth(Math.min(520, Math.max(200, nextWidth)));
      }

      if (requestPaneResizeRef.current) {
        const nextWidth = requestPaneResizeRef.current.startSize + (event.clientX - requestPaneResizeRef.current.startX);
        setRequestPaneSize(Math.min(900, Math.max(300, nextWidth)));
      }

      if (requestPaneResizeYRef.current) {
        const nextHeight = requestPaneResizeYRef.current.startSize + (event.clientY - requestPaneResizeYRef.current.startY);
        setRequestPaneSize(Math.min(900, Math.max(260, nextHeight)));
      }
    };

    const handleMouseUp = () => {
      if (sidebarResizeRef.current) {
        sidebarResizeRef.current = null;
      }
      if (requestPaneResizeRef.current) {
        requestPaneResizeRef.current = null;
      }
      if (requestPaneResizeYRef.current) {
        requestPaneResizeYRef.current = null;
      }
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, []);

  const startSidebarResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    sidebarResizeRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    document.body.style.userSelect = 'none';
  };

  const startRequestPaneResize = (event: React.MouseEvent<HTMLDivElement>, mode: 'horizontal' | 'vertical') => {
    event.preventDefault();
    if (mode === 'horizontal') {
      requestPaneResizeRef.current = {
        startX: event.clientX,
        startSize: requestPaneSize,
      };
    } else {
      requestPaneResizeYRef.current = {
        startY: event.clientY,
        startSize: requestPaneSize,
      };
    }
    document.body.style.userSelect = 'none';
  };

  // Modals & Drawers state
  // panelMode: 'closed' | 'minimized' | 'normal' | 'maximized'
  type PanelMode = 'closed' | 'minimized' | 'normal' | 'maximized';
  const [panelMode, setPanelMode] = useState<PanelMode>('closed');
  const copilotOpen = panelMode !== 'closed';
  const [curlModalOpen, setCurlModalOpen] = useState(false);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [suiteRunnerOpen, setSuiteRunnerOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Debounced autosave ref
  const autoSaveTimerRef = useRef<any>(null);

  const updateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('courier_app_settings', JSON.stringify(newSettings));
  };

  // Initial Load
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const cols = await fetchCollections();
      setCollections(cols);

      const envs = await fetchEnvironments();
      setEnvironments(envs);
      if (envs.length > 0 && !selectedEnvId) {
        setSelectedEnvId(envs[0].id);
      }

      // Open first request if available
      if (cols.length > 0) {
        const firstCol = cols[0];
        let firstReq = firstCol.requests?.[0];
        if (!firstReq && firstCol.folders?.length) {
          firstReq = firstCol.folders[0].requests?.[0];
        }
        if (firstReq) {
          setOpenTabs([{ collectionId: firstCol.id, request: firstReq }]);
          setActiveRequestId(firstReq.id);
          setActiveCollectionId(firstCol.id);
        }
      }
    } catch (err) {
      console.error('Failed to load initial Courier data:', err);
    }
  };

  // Find currently active request
  const activeTabItem = openTabs.find(t => t.request.id === activeRequestId);
  const activeRequest = activeTabItem?.request || null;

  // Handle Tab Selection
  const handleSelectRequest = (collectionId: string, req: CourierRequest) => {
    const existing = openTabs.find(t => t.request.id === req.id);
    if (!existing) {
      setOpenTabs(prev => [...prev, { collectionId, request: req }]);
    }
    setActiveRequestId(req.id);
    setActiveCollectionId(collectionId);
    setCurrentResponse(null);
  };

  const handleCloseTab = (requestId: string) => {
    const remaining = openTabs.filter(t => t.request.id !== requestId);
    setOpenTabs(remaining);
    if (activeRequestId === requestId) {
      if (remaining.length > 0) {
        setActiveRequestId(remaining[remaining.length - 1].request.id);
        setActiveCollectionId(remaining[remaining.length - 1].collectionId);
      } else {
        setActiveRequestId(null);
        setActiveCollectionId(null);
      }
    }
  };

  // Update in-memory request in tabs + Auto-Save
  const handleUpdateRequest = (updatedReq: CourierRequest) => {
    setOpenTabs(prev =>
      prev.map(t =>
        t.request.id === updatedReq.id ? { ...t, request: updatedReq } : t
      )
    );

    // Auto-save logic if enabled
    if (settings.autoSave && activeCollectionId) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        saveRequestDirectly(updatedReq, activeCollectionId);
      }, 800);
    }
  };

  const saveRequestDirectly = async (reqToSave: CourierRequest, colId: string) => {
    const targetCol = collections.find(c => c.id === colId);
    if (!targetCol) return;

    let updatedRequests = targetCol.requests || [];
    let updatedFolders = targetCol.folders || [];
    let foundInDirect = updatedRequests.some(r => r.id === reqToSave.id);

    if (foundInDirect) {
      updatedRequests = updatedRequests.map(r => r.id === reqToSave.id ? reqToSave : r);
    } else {
      updatedFolders = updatedFolders.map(folder => ({
        ...folder,
        requests: (folder.requests || []).map(r => r.id === reqToSave.id ? reqToSave : r)
      }));
    }

    const updatedCol = { ...targetCol, requests: updatedRequests, folders: updatedFolders };
    try {
      await saveCollection(updatedCol);
      setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
    } catch (err: any) {
      console.warn('Auto-save error:', err.message);
    }
  };

  // Manual Save
  const handleSaveRequest = async () => {
    if (!activeRequest || !activeCollectionId) return;
    try {
      await saveRequestDirectly(activeRequest, activeCollectionId);
      alert('Request saved successfully to disk!');
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

  // Send Request
  const handleSendRequest = async () => {
    if (!activeRequest) return;
    setIsLoadingRequest(true);

    const activeEnv = environments.find(e => e.id === selectedEnvId);
    const envVars: Record<string, string> = {};
    if (activeEnv?.variables) {
      activeEnv.variables.forEach(v => {
        if (v.enabled) envVars[v.key] = v.value;
      });
    }

    try {
      const response = await executeRequest(activeRequest, envVars, settings);
      setCurrentResponse(response);
    } catch (err: any) {
      setCurrentResponse({
        status: 0,
        statusText: 'Execution Error',
        headers: {},
        data: { error: err.message },
        timeMs: 0,
        sizeBytes: 0,
        curlCommand: '',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoadingRequest(false);
    }
  };

  // Create Request (inside collection or subfolder)
  const handleCreateRequest = async (collectionId: string, folderId?: string) => {
    const targetCol = collections.find(c => c.id === collectionId);
    if (!targetCol) return;

    const newReq: CourierRequest = {
      id: `req-${Date.now()}`,
      name: 'New Request',
      method: 'GET',
      url: 'https://httpbin.org/get',
      params: [],
      pathParams: [],
      headers: [],
      auth: { type: 'none' },
      bodyType: 'none',
      body: '',
      assertions: [
        { id: `a-${Date.now()}`, name: 'Status is 200', type: 'STATUS_CODE_EQUALS', expected: '200', enabled: true }
      ],
    };

    let updatedCol: CourierCollection;
    if (folderId) {
      const updatedFolders = (targetCol.folders || []).map(f =>
        f.id === folderId ? { ...f, requests: [...(f.requests || []), newReq] } : f
      );
      updatedCol = { ...targetCol, folders: updatedFolders };
    } else {
      updatedCol = { ...targetCol, requests: [...(targetCol.requests || []), newReq] };
    }

    await saveCollection(updatedCol);
    setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
    handleSelectRequest(collectionId, newReq);
  };

  // Duplicate / Clone Request
  const handleDuplicateRequest = async (collectionId: string, requestToClone: CourierRequest) => {
    const targetCol = collections.find(c => c.id === collectionId);
    if (!targetCol) return;

    const cloned: CourierRequest = {
      ...JSON.parse(JSON.stringify(requestToClone)),
      id: `req-${Date.now()}`,
      name: `${requestToClone.name} (Copy)`,
    };

    let updatedCol: CourierCollection;
    const inDirect = (targetCol.requests || []).some(r => r.id === requestToClone.id);

    if (inDirect) {
      updatedCol = { ...targetCol, requests: [...targetCol.requests, cloned] };
    } else {
      const updatedFolders = (targetCol.folders || []).map(folder => {
        if ((folder.requests || []).some(r => r.id === requestToClone.id)) {
          return { ...folder, requests: [...folder.requests, cloned] };
        }
        return folder;
      });
      updatedCol = { ...targetCol, folders: updatedFolders };
    }

    await saveCollection(updatedCol);
    setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
    handleSelectRequest(collectionId, cloned);
  };

  // Create Collection
  const handleCreateCollection = async () => {
    const name = prompt('Enter new collection name:');
    if (!name) return;

    const newCol: CourierCollection = {
      id: `col-${Date.now()}`,
      name,
      requests: [],
      folders: [],
    };

    await saveCollection(newCol);
    setCollections(prev => [...prev, newCol]);
  };

  // Duplicate / Clone Collection
  const handleDuplicateCollection = async (collectionId: string) => {
    const targetCol = collections.find(c => c.id === collectionId);
    if (!targetCol) return;

    const cloned: CourierCollection = {
      ...JSON.parse(JSON.stringify(targetCol)),
      id: `col-${Date.now()}`,
      name: `${targetCol.name} (Copy)`,
    };

    await saveCollection(cloned);
    setCollections(prev => [...prev, cloned]);
  };

  // Create Subfolder
  const handleCreateFolder = async (collectionId: string) => {
    const targetCol = collections.find(c => c.id === collectionId);
    if (!targetCol) return;

    const name = prompt('Enter folder name:');
    if (!name) return;

    const newFolder: CourierFolder = {
      id: `folder-${Date.now()}`,
      name,
      requests: [],
    };

    const updatedCol = {
      ...targetCol,
      folders: [...(targetCol.folders || []), newFolder],
    };

    await saveCollection(updatedCol);
    setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
  };

  // Delete Subfolder
  const handleDeleteFolder = async (collectionId: string, folderId: string) => {
    const targetCol = collections.find(c => c.id === collectionId);
    if (!targetCol) return;

    if (!confirm('Are you sure you want to delete this folder and its requests?')) return;

    const updatedCol = {
      ...targetCol,
      folders: (targetCol.folders || []).filter(f => f.id !== folderId),
    };

    await saveCollection(updatedCol);
    setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
  };

  // Delete Request
  const handleDeleteRequest = async (collectionId: string, requestId: string) => {
    const targetCol = collections.find(c => c.id === collectionId);
    if (!targetCol) return;

    const updatedRequests = (targetCol.requests || []).filter(r => r.id !== requestId);
    const updatedFolders = (targetCol.folders || []).map(f => ({
      ...f,
      requests: (f.requests || []).filter(r => r.id !== requestId)
    }));

    const updatedCol = { ...targetCol, requests: updatedRequests, folders: updatedFolders };
    await saveCollection(updatedCol);
    setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
    handleCloseTab(requestId);
  };

  // Delete Collection
  const handleDeleteCollection = async (collectionId: string) => {
    await deleteCollection(collectionId);
    setCollections(prev => prev.filter(c => c.id !== collectionId));
    setOpenTabs(prev => prev.filter(t => t.collectionId !== collectionId));
  };

  // Import cURL
  const handleImportCurl = (parsed: Partial<CourierRequest>) => {
    if (!activeCollectionId && collections.length > 0) {
      setActiveCollectionId(collections[0].id);
    }
    const targetColId = activeCollectionId || collections[0]?.id;
    if (!targetColId) return;

    const newReq: CourierRequest = {
      id: `req-${Date.now()}`,
      name: parsed.url ? `cURL: ${parsed.url.split('/').pop() || 'Request'}` : 'Imported cURL',
      method: parsed.method || 'GET',
      url: parsed.url || '',
      params: parsed.params || [],
      pathParams: [],
      headers: parsed.headers || [],
      auth: parsed.auth || { type: 'none' },
      bodyType: parsed.bodyType || 'none',
      body: parsed.body || '',
      assertions: [
        { id: `a-${Date.now()}`, name: 'Status is 2xx', type: 'STATUS_IS_2XX', expected: '', enabled: true }
      ],
    };

    const targetCol = collections.find(c => c.id === targetColId);
    if (targetCol) {
      const updatedCol = {
        ...targetCol,
        requests: [...(targetCol.requests || []), newReq],
      };
      saveCollection(updatedCol);
      setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
      handleSelectRequest(targetColId, newReq);
    }
  };

  // Copilot Suggestions Handlers
  const handleApplyCopilotRequest = (requestPatch: Partial<CourierRequest>) => {
    if (!activeRequest) return;
    const updated = { ...activeRequest, ...requestPatch };
    handleUpdateRequest(updated);
    setPanelMode('closed');
  };

  const handleApplyCopilotAssertions = (assertions: TestAssertion[]) => {
    if (!activeRequest) return;
    const updated = {
      ...activeRequest,
      assertions: [...activeRequest.assertions, ...assertions],
    };
    handleUpdateRequest(updated);
    setPanelMode('closed');
  };

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#0c0c0e] text-zinc-200"
      data-theme="dark"
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--text-primary)' }}
    >
      {/* Top Header */}
      <Header
        environments={environments}
        selectedEnvId={selectedEnvId}
        onSelectEnv={setSelectedEnvId}
        onOpenEnvModal={() => setEnvModalOpen(true)}
        onOpenCurlModal={() => setCurlModalOpen(true)}
        onOpenSuiteRunner={() => setSuiteRunnerOpen(true)}
        onOpenSettingsModal={() => setSettingsModalOpen(true)}
        layout={settings.layout}
        onToggleLayout={() => updateSettings({
          ...settings,
          layout: settings.layout === 'horizontal' ? 'vertical' : 'horizontal',
        })}
        copilotOpen={copilotOpen}
        onToggleCopilot={() => setPanelMode(panelMode === 'closed' ? 'normal' : 'closed')}
      />

      {/* Main Workbench Area — Sidebar | Canvas | Chetan Panel */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Collections Sidebar */}
        <Sidebar
          collections={collections}
          activeRequestId={activeRequestId}
          width={sidebarWidth}
          onSelectRequest={handleSelectRequest}
          onCreateRequest={handleCreateRequest}
          onCreateCollection={handleCreateCollection}
          onDuplicateRequest={handleDuplicateRequest}
          onDuplicateCollection={handleDuplicateCollection}
          onCreateFolder={handleCreateFolder}
          onDeleteRequest={handleDeleteRequest}
          onDeleteCollection={handleDeleteCollection}
          onDeleteFolder={handleDeleteFolder}
        />

        <div
          className="relative w-px cursor-col-resize bg-zinc-700/80 hover:bg-zinc-500/90"
          onMouseDown={startSidebarResize}
          aria-label="Resize sidebar"
          title="Drag to resize sidebar"
        />

        {/* Center Workspace (Tabs + Request + Response) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Tabs */}
          <RequestTabs
            openRequests={openTabs}
            activeRequestId={activeRequestId}
            onSelectTab={setActiveRequestId}
            onCloseTab={handleCloseTab}
          />

          {/* Workbench Grid: Side-by-Side vs Stacked Underneath */}
          {activeRequest ? (
            <div className={`flex-1 flex overflow-hidden ${
              settings.layout === 'vertical' ? 'flex-col' : 'flex-col md:flex-row'
            }`}>
              {/* Request Panel */}
              <div
                className={`min-w-0 overflow-hidden ${
                  settings.layout === 'vertical'
                    ? 'border-b border-zinc-800'
                    : 'border-b md:border-b-0 md:border-r border-zinc-800'
                }`}
                style={settings.layout === 'vertical'
                  ? { height: `${requestPaneSize}px` }
                  : { width: `${requestPaneSize}px`, minWidth: '300px' }}
              >
                <RequestPanel
                  request={activeRequest}
                  isLoading={isLoadingRequest}
                  onUpdateRequest={handleUpdateRequest}
                  onSendRequest={handleSendRequest}
                  onSaveRequest={handleSaveRequest}
                />
              </div>

              <div
                className={`relative ${settings.layout === 'vertical' ? 'h-px cursor-row-resize bg-zinc-700/80 hover:bg-zinc-500/90' : 'w-px cursor-col-resize bg-zinc-700/80 hover:bg-zinc-500/90'}`}
                onMouseDown={(event) => startRequestPaneResize(event, settings.layout === 'vertical' ? 'vertical' : 'horizontal')}
                aria-label="Resize request and response area"
                title="Drag to resize"
              />

              {/* Response Panel */}
              <div className={`min-w-0 overflow-hidden ${
                settings.layout === 'vertical' ? 'flex-1' : 'flex-1 h-full'
              }`}>
                <ResponsePanel
                  response={currentResponse}
                  isLoading={isLoadingRequest}
                  onDiagnoseWithCopilot={() => setPanelMode('normal')}
                  onAutoGenerateTests={() => setPanelMode('normal')}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                <svg className="w-6 h-6 text-emerald-500/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-zinc-400">Welcome to Courier</p>
              <p className="text-xs text-zinc-500">Select an existing request from the sidebar or click + to start testing.</p>
            </div>
          )}
        </div>

        {/* ── Chetan AI Panel (inline, not fixed) ── */}
        {/* Resize handle — only visible in normal/maximized modes */}
        {(panelMode === 'normal' || panelMode === 'maximized') && (
          <div className="w-px bg-zinc-700/80 hover:bg-zinc-500/90 cursor-col-resize" />
        )}

        {/* The panel itself — transitions between all 4 width states */}
        <div
          className={`
            flex-shrink-0 overflow-hidden
            transition-all duration-300 ease-in-out
            ${panelMode === 'closed'    ? 'w-0'   : ''}
            ${panelMode === 'minimized' ? 'w-12'  : ''}
            ${panelMode === 'normal'    ? 'w-[400px]' : ''}
            ${panelMode === 'maximized' ? 'w-1/2' : ''}
          `}
        >
          <CopilotDrawer
            isOpen={panelMode !== 'closed'}
            panelMode={panelMode}
            onClose={() => setPanelMode('closed')}
            onMinimize={() => setPanelMode(panelMode === 'minimized' ? 'normal' : 'minimized')}
            onMaximize={() => setPanelMode(panelMode === 'maximized' ? 'normal' : 'maximized')}
            currentRequest={activeRequest}
            currentResponse={currentResponse}
            onApplyRequest={handleApplyCopilotRequest}
            onApplyAssertions={handleApplyCopilotAssertions}
          />
        </div>
      </div>

      {/* Modals */}
      <CurlImportModal
        isOpen={curlModalOpen}
        onClose={() => setCurlModalOpen(false)}
        onImport={handleImportCurl}
      />

      <EnvironmentModal
        isOpen={envModalOpen}
        onClose={() => setEnvModalOpen(false)}
        environments={environments}
        onSaveEnvironment={async (env) => {
          const saved = await saveEnvironment(env);
          setEnvironments(prev => {
            const exists = prev.some(e => e.id === saved.id);
            return exists ? prev.map(e => e.id === saved.id ? saved : e) : [...prev, saved];
          });
        }}
        onDeleteEnvironment={async (id) => {
          await deleteEnvironment(id);
          setEnvironments(prev => prev.filter(e => e.id !== id));
        }}
      />

      <SuiteRunnerModal
        isOpen={suiteRunnerOpen}
        onClose={() => setSuiteRunnerOpen(false)}
        collections={collections}
        environments={environments}
        selectedEnvId={selectedEnvId}
      />

      {/* Settings Modal (SSL Toggle, Autosave, Layout, Timeout) */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
      />
    </div>
  );
};

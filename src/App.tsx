import React, { useState, useEffect } from 'react';
import {
  fetchCollections,
  saveCollection,
  deleteCollection,
  fetchEnvironments,
  saveEnvironment,
  deleteEnvironment,
  executeRequest,
} from './services/api';
import { CourierCollection, CourierRequest, Environment, HttpResponse, TestAssertion } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { RequestTabs } from './components/RequestTabs';
import { RequestPanel } from './components/RequestPanel';
import { ResponsePanel } from './components/ResponsePanel';
import { CopilotDrawer } from './components/CopilotDrawer';
import { CurlImportModal } from './components/CurlImportModal';
import { EnvironmentModal } from './components/EnvironmentModal';
import { SuiteRunnerModal } from './components/SuiteRunnerModal';

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

  // Modals & Drawers state
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [curlModalOpen, setCurlModalOpen] = useState(false);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [suiteRunnerOpen, setSuiteRunnerOpen] = useState(false);

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
      if (cols.length > 0 && cols[0].requests.length > 0) {
        const firstCol = cols[0];
        const firstReq = firstCol.requests[0];
        setOpenTabs([{ collectionId: firstCol.id, request: firstReq }]);
        setActiveRequestId(firstReq.id);
        setActiveCollectionId(firstCol.id);
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
    setCurrentResponse(null); // Reset response on request change
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

  // Update in-memory request in tabs
  const handleUpdateRequest = (updatedReq: CourierRequest) => {
    setOpenTabs(prev =>
      prev.map(t =>
        t.request.id === updatedReq.id ? { ...t, request: updatedReq } : t
      )
    );
  };

  // Save changes to local collection file
  const handleSaveRequest = async () => {
    if (!activeRequest || !activeCollectionId) return;

    const targetCol = collections.find(c => c.id === activeCollectionId);
    if (!targetCol) return;

    const updatedRequests = targetCol.requests.map(r =>
      r.id === activeRequest.id ? activeRequest : r
    );

    const updatedCol = { ...targetCol, requests: updatedRequests };
    try {
      await saveCollection(updatedCol);
      setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
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
      const response = await executeRequest(activeRequest, envVars);
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

  // Collection actions
  const handleCreateRequest = async (collectionId: string) => {
    const targetCol = collections.find(c => c.id === collectionId);
    if (!targetCol) return;

    const newReq: CourierRequest = {
      id: `req-${Date.now()}`,
      name: 'New Request',
      method: 'GET',
      url: 'https://httpbin.org/get',
      params: [],
      headers: [],
      auth: { type: 'none' },
      bodyType: 'none',
      body: '',
      assertions: [
        { id: `a-${Date.now()}`, name: 'Status is 200', type: 'STATUS_CODE_EQUALS', expected: '200', enabled: true }
      ],
    };

    const updatedCol = {
      ...targetCol,
      requests: [...targetCol.requests, newReq],
    };

    await saveCollection(updatedCol);
    setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
    handleSelectRequest(collectionId, newReq);
  };

  const handleCreateCollection = async () => {
    const name = prompt('Enter new collection name:');
    if (!name) return;

    const newCol: CourierCollection = {
      id: `col-${Date.now()}`,
      name,
      requests: [],
    };

    await saveCollection(newCol);
    setCollections(prev => [...prev, newCol]);
  };

  const handleDeleteRequest = async (collectionId: string, requestId: string) => {
    const targetCol = collections.find(c => c.id === collectionId);
    if (!targetCol) return;

    const updatedCol = {
      ...targetCol,
      requests: targetCol.requests.filter(r => r.id !== requestId),
    };

    await saveCollection(updatedCol);
    setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
    handleCloseTab(requestId);
  };

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
        requests: [...targetCol.requests, newReq],
      };
      saveCollection(updatedCol);
      setCollections(prev => prev.map(c => c.id === updatedCol.id ? updatedCol : c));
      handleSelectRequest(targetColId, newReq);
    }
  };

  // Copilot Suggestions Handlers
  const handleApplyCopilotRequest = (requestPatch: Partial<CourierRequest>) => {
    if (!activeRequest) return;
    const updated = {
      ...activeRequest,
      ...requestPatch,
    };
    handleUpdateRequest(updated);
    setCopilotOpen(false);
  };

  const handleApplyCopilotAssertions = (assertions: TestAssertion[]) => {
    if (!activeRequest) return;
    const updated = {
      ...activeRequest,
      assertions: [...activeRequest.assertions, ...assertions],
    };
    handleUpdateRequest(updated);
    setCopilotOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0c0c0e] text-zinc-200">
      {/* Top Header */}
      <Header
        environments={environments}
        selectedEnvId={selectedEnvId}
        onSelectEnv={setSelectedEnvId}
        onOpenEnvModal={() => setEnvModalOpen(true)}
        onOpenCurlModal={() => setCurlModalOpen(true)}
        onOpenSuiteRunner={() => setSuiteRunnerOpen(true)}
        copilotOpen={copilotOpen}
        onToggleCopilot={() => setCopilotOpen(!copilotOpen)}
      />

      {/* Main Workbench Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Collections Sidebar */}
        <Sidebar
          collections={collections}
          activeRequestId={activeRequestId}
          onSelectRequest={handleSelectRequest}
          onCreateRequest={handleCreateRequest}
          onCreateCollection={handleCreateCollection}
          onDeleteRequest={handleDeleteRequest}
          onDeleteCollection={handleDeleteCollection}
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

          {/* Workbench Grid: Left Request Composer, Right Response Inspector */}
          {activeRequest ? (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className="flex-1 min-w-0 h-full overflow-hidden border-b md:border-b-0 md:border-r border-zinc-800">
                <RequestPanel
                  request={activeRequest}
                  isLoading={isLoadingRequest}
                  onUpdateRequest={handleUpdateRequest}
                  onSendRequest={handleSendRequest}
                  onSaveRequest={handleSaveRequest}
                />
              </div>

              <div className="flex-1 min-w-0 h-full overflow-hidden">
                <ResponsePanel
                  response={currentResponse}
                  isLoading={isLoadingRequest}
                  onDiagnoseWithCopilot={() => setCopilotOpen(true)}
                  onAutoGenerateTests={() => setCopilotOpen(true)}
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
      </div>

      {/* Courier Copilot AI Assistant Drawer */}
      <CopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        currentRequest={activeRequest}
        currentResponse={currentResponse}
        onApplyRequest={handleApplyCopilotRequest}
        onApplyAssertions={handleApplyCopilotAssertions}
      />

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
    </div>
  );
};


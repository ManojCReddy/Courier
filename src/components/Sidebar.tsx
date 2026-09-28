import React, { useState } from 'react';
import {
  Folder,
  ChevronRight,
  ChevronDown,
  Plus,
  Search,
  Trash2,
  Copy,
  FolderPlus,
  FileCode,
  FolderTree,
  ArrowDownAZ,
  ArrowUpAZ
} from 'lucide-react';
import { CourierCollection, CourierRequest, CourierFolder, HttpMethod } from '../types';

interface SidebarProps {
  collections: CourierCollection[];
  activeRequestId: string | null;
  width?: number;
  onSelectRequest: (collectionId: string, request: CourierRequest) => void;
  onCreateRequest: (collectionId: string, folderId?: string) => void;
  onCreateCollection: (name: string) => Promise<void>;
  onDuplicateRequest: (collectionId: string, request: CourierRequest) => void;
  onDuplicateCollection: (collectionId: string) => void;
  onCreateFolder: (collectionId: string, name: string) => Promise<void>;
  onDeleteRequest: (collectionId: string, requestId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onDeleteFolder?: (collectionId: string, folderId: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  activeRequestId,
  width = 280,
  onSelectRequest,
  onCreateRequest,
  onCreateCollection,
  onDuplicateRequest,
  onDuplicateCollection,
  onCreateFolder,
  onDeleteRequest,
  onDeleteCollection,
  onDeleteFolder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionSort, setCollectionSort] = useState<'asc' | 'desc'>('asc');
  const [requestSortByCollection, setRequestSortByCollection] = useState<Record<string, 'asc' | 'desc'>>({});
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({
    'col-sample-1': true,
  });
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [createTarget, setCreateTarget] = useState<{ type: 'collection' } | { type: 'folder'; collectionId: string } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedCollections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleExpandFolder = (id: string) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openCreateDialog = (target: { type: 'collection' } | { type: 'folder'; collectionId: string }) => {
    setCreateTarget(target);
    setNewItemName('');
    setCreateError('');
  };

  const submitCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newItemName.trim();
    if (!name || !createTarget) return;

    setIsCreating(true);
    setCreateError('');
    try {
      if (createTarget.type === 'collection') {
        await onCreateCollection(name);
      } else {
        await onCreateFolder(createTarget.collectionId, name);
        setExpandedCollections(prev => ({ ...prev, [createTarget.collectionId]: true }));
      }
      setCreateTarget(null);
      setNewItemName('');
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create item.');
    } finally {
      setIsCreating(false);
    }
  };

  const getMethodColor = (method: HttpMethod) => {
    switch (method) {
      case 'GET': return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40';
      case 'POST': return 'text-blue-400 bg-blue-950/40 border-blue-800/40';
      case 'PUT': return 'text-amber-400 bg-amber-950/40 border-amber-800/40';
      case 'PATCH': return 'text-purple-400 bg-purple-950/40 border-purple-800/40';
      case 'DELETE': return 'text-rose-400 bg-rose-950/40 border-rose-800/40';
      default: return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  const sortedCollections = [...collections].sort((left, right) => {
    const comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    return collectionSort === 'asc' ? comparison : -comparison;
  });

  const getRequestSort = (collectionId: string) => requestSortByCollection[collectionId] || 'asc';

  const sortRequests = (requests: CourierRequest[], collectionId: string) => {
    const direction = getRequestSort(collectionId);
    return [...requests].sort((left, right) => {
      const comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      return direction === 'asc' ? comparison : -comparison;
    });
  };

  const toggleRequestSort = (collectionId: string) => {
    setRequestSortByCollection(prev => ({
      ...prev,
      [collectionId]: getRequestSort(collectionId) === 'asc' ? 'desc' : 'asc',
    }));
  };

  const renderRequestItem = (colId: string, req: CourierRequest) => {
    const isSelected = activeRequestId === req.id;
    return (
      <div
        key={req.id}
        onClick={() => onSelectRequest(colId, req)}
        className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
          isSelected
            ? 'bg-zinc-800 text-zinc-100 font-medium border-l-2 border-emerald-500'
            : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
        }`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <span className={`text-[10px] font-mono px-1 py-0.2 rounded border font-semibold ${getMethodColor(req.method)}`}>
            {req.method}
          </span>
          <span className="truncate">{req.name}</span>
        </div>

        {/* Action icons: Duplicate & Delete */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateRequest(colId, req);
            }}
            className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded"
            title="Duplicate / Clone Request"
          >
            <Copy className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRequest(colId, req.id);
            }}
            className="p-1 hover:bg-zinc-700 text-zinc-500 hover:text-rose-400 rounded"
            title="Delete Request"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <aside
      style={{ width: `${width}px` }}
      className="border-r border-zinc-800 bg-[#0f0f12] flex flex-col h-[calc(100vh-3.5rem)] min-h-0 select-none flex-shrink-0 relative transition-none"
    >
      {/* Top Search & Actions */}
      <div className="p-3 border-b border-zinc-800/80 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Collections</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCollectionSort(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title={collectionSort === 'asc' ? 'Sort collections Z-A' : 'Sort collections A-Z'}
              aria-label={collectionSort === 'asc' ? 'Sort collections Z-A' : 'Sort collections A-Z'}
            >
              {collectionSort === 'asc' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
            </button>
            <button
              onClick={() => openCreateDialog({ type: 'collection' })}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Create New Collection"
              aria-label="Create New Collection"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
      </div>

      {/* Collections List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {collections.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs">
            No collections yet.<br />Click + to create one.
          </div>
        ) : (
          sortedCollections.map((col) => {
            const isExpanded = expandedCollections[col.id] ?? true;
            const filteredDirectRequests = (col.requests || []).filter(r =>
              r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              r.url.toLowerCase().includes(searchQuery.toLowerCase())
            );

            return (
              <div key={col.id} className="space-y-0.5">
                {/* Collection Row */}
                <div className="group flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-800/60 cursor-pointer text-xs transition-colors">
                  <div
                    className="flex items-center gap-1.5 flex-1 min-w-0"
                    onClick={() => toggleExpand(col.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                    )}
                    <Folder className="w-3.5 h-3.5 text-emerald-500/80 flex-shrink-0" />
                    <span className="font-medium text-zinc-300 truncate">{col.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">({(col.requests || []).length})</span>
                  </div>

                  {/* Actions */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateRequest(col.id);
                      }}
                      className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded"
                      title="Add Request"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreateDialog({ type: 'folder', collectionId: col.id });
                      }}
                      className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded"
                      title="Add Subfolder"
                    >
                      <FolderTree className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRequestSort(col.id);
                      }}
                      className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded"
                      title={getRequestSort(col.id) === 'asc' ? 'Sort requests Z-A' : 'Sort requests A-Z'}
                      aria-label={getRequestSort(col.id) === 'asc' ? 'Sort requests Z-A' : 'Sort requests A-Z'}
                    >
                      {getRequestSort(col.id) === 'asc' ? <ArrowDownAZ className="w-3 h-3" /> : <ArrowUpAZ className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicateCollection(col.id);
                      }}
                      className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded"
                      title="Clone / Duplicate Collection"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete collection "${col.name}"?`)) {
                          onDeleteCollection(col.id);
                        }
                      }}
                      className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 rounded"
                      title="Delete Collection"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Collection Children */}
                {isExpanded && (
                  <div className="ml-4 pl-2 border-l border-zinc-800/80 space-y-0.5 mt-0.5">
                    {/* Subfolders */}
                    {(col.folders || []).map((folder) => {
                      const isFolderExpanded = expandedFolders[folder.id] ?? true;
                      return (
                        <div key={folder.id} className="space-y-0.5">
                          <div className="group flex items-center justify-between px-2 py-1 rounded-md hover:bg-zinc-800/40 cursor-pointer text-xs text-zinc-400">
                            <div
                              className="flex items-center gap-1.5 flex-1 min-w-0"
                              onClick={() => toggleExpandFolder(folder.id)}
                            >
                              {isFolderExpanded ? (
                                <ChevronDown className="w-3 h-3 text-zinc-500" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-zinc-500" />
                              )}
                              <Folder className="w-3 h-3 text-blue-400/80" />
                              <span className="font-medium text-zinc-300 truncate">{folder.name}</span>
                            </div>

                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCreateRequest(col.id, folder.id);
                                }}
                                className="p-0.5 hover:bg-zinc-700 text-zinc-400 rounded"
                                title="Add request to folder"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                              {onDeleteFolder && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteFolder(col.id, folder.id);
                                  }}
                                  className="p-0.5 hover:bg-zinc-700 text-zinc-500 hover:text-rose-400 rounded"
                                  title="Delete folder"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Folder Requests */}
                          {isFolderExpanded && (
                            <div className="ml-3 pl-2 border-l border-zinc-800/60 space-y-0.5">
                              {sortRequests(folder.requests || [], col.id).map((r) => renderRequestItem(col.id, r))}
                              {(!folder.requests || folder.requests.length === 0) && (
                                <div className="text-[10px] text-zinc-600 px-2 py-0.5 italic">Empty folder</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Direct Collection Requests */}
                    {sortRequests(filteredDirectRequests, col.id).map((req) => renderRequestItem(col.id, req))}

                    {filteredDirectRequests.length === 0 && (!col.folders || col.folders.length === 0) && (
                      <div className="text-[11px] text-zinc-600 px-2 py-1 italic">
                        {searchQuery ? 'No matching requests' : 'Empty collection'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {createTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={(event) => void submitCreate(event)}
            className="w-full max-w-sm rounded-lg border border-zinc-700 bg-[#15151a] p-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-item-title"
          >
            <h2 id="create-item-title" className="mb-3 text-sm font-semibold text-zinc-100">
              {createTarget.type === 'collection' ? 'New collection' : 'New folder'}
            </h2>
            <input
              autoFocus
              value={newItemName}
              onChange={(event) => setNewItemName(event.target.value)}
              placeholder={createTarget.type === 'collection' ? 'Collection name' : 'Folder name'}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500"
              aria-label={createTarget.type === 'collection' ? 'Collection name' : 'Folder name'}
            />
            {createError && <p className="mt-2 text-xs text-rose-400">{createError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateTarget(null)}
                disabled={isCreating}
                className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newItemName.trim() || isCreating}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Footer Info */}
      <div className="p-3 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center justify-between">
        <span>Filesystem Synced</span>
        <span className="font-mono text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400">./courier-data</span>
      </div>
    </aside>
  );
};

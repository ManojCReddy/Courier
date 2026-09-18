import React from 'react';
import { X } from 'lucide-react';
import { CourierRequest, HttpMethod } from '../types';

interface RequestTabsProps {
  openRequests: Array<{ collectionId: string; request: CourierRequest }>;
  activeRequestId: string | null;
  onSelectTab: (requestId: string) => void;
  onCloseTab: (requestId: string) => void;
}

export const RequestTabs: React.FC<RequestTabsProps> = ({
  openRequests,
  activeRequestId,
  onSelectTab,
  onCloseTab,
}) => {
  if (openRequests.length === 0) return null;

  const getMethodColor = (method: HttpMethod) => {
    switch (method) {
      case 'GET': return 'text-emerald-400';
      case 'POST': return 'text-blue-400';
      case 'PUT': return 'text-amber-400';
      case 'PATCH': return 'text-purple-400';
      case 'DELETE': return 'text-rose-400';
      default: return 'text-zinc-400';
    }
  };

  return (
    <div className="flex items-center bg-[#101014] border-b border-zinc-800 overflow-x-auto select-none">
      {openRequests.map(({ request }) => {
        const isActive = activeRequestId === request.id;
        return (
          <div
            key={request.id}
            onClick={() => onSelectTab(request.id)}
            className={`group flex items-center gap-2 px-3 py-2 border-r border-zinc-800 text-xs cursor-pointer border-t-2 transition-colors min-w-[130px] max-w-[220px] ${
              isActive
                ? 'bg-[#18181d] text-zinc-100 border-t-emerald-500 font-medium'
                : 'bg-[#101014] text-zinc-400 border-t-transparent hover:bg-zinc-850 hover:text-zinc-200'
            }`}
          >
            <span className={`text-[10px] font-mono font-bold ${getMethodColor(request.method)}`}>
              {request.method}
            </span>
            <span className="truncate flex-1">{request.name || 'Untitled'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(request.id);
              }}
              className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 opacity-60 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};


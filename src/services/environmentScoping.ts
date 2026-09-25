import { CourierCollection, CourierFolder, CourierRequest, Environment, KeyValuePair, EnvironmentVariable } from '../types';

export interface VariableScopeEntry {
  tier: 'local' | 'folder' | 'collection' | 'global';
  scopeName: string;
  key: string;
  value: string;
  enabled: boolean;
  isOverridden?: boolean;
}

export interface RequestHierarchy {
  collection?: CourierCollection;
  folders: CourierFolder[];
  request?: CourierRequest;
}

/**
 * Dynamic built-in variable generators (e.g. {{$guid}}, {{$timestamp}})
 */
const dynamicGenerators: Record<string, () => string> = {
  '$guid': () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
  '$uuid': () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
  '$timestamp': () => Math.floor(Date.now() / 1000).toString(),
  '$isoTimestamp': () => new Date().toISOString(),
  '$randomInt': () => Math.floor(Math.random() * 10000).toString(),
  '$randomEmail': () => `user_${Math.floor(Math.random() * 10000)}@test.com`,
};

/**
 * Searches through collections and nested folders to find the exact hierarchy
 * (Collection -> Folders -> Request) for a given request ID.
 */
export function findRequestHierarchy(
  collections: CourierCollection[],
  requestId: string
): RequestHierarchy {
  for (const col of collections) {
    // 1. Direct request under collection
    const directReq = (col.requests || []).find(r => r.id === requestId);
    if (directReq) {
      return { collection: col, folders: [], request: directReq };
    }

    // 2. Search recursively in folders
    const searchInFolders = (folders: CourierFolder[], currentPath: CourierFolder[]): RequestHierarchy | null => {
      for (const folder of folders) {
        const nextPath = [...currentPath, folder];
        const foundReq = (folder.requests || []).find(r => r.id === requestId);
        if (foundReq) {
          return { collection: col, folders: nextPath, request: foundReq };
        }
        if (folder.folders && folder.folders.length > 0) {
          const nested = searchInFolders(folder.folders, nextPath);
          if (nested) return nested;
        }
      }
      return null;
    };

    if (col.folders && col.folders.length > 0) {
      const match = searchInFolders(col.folders, []);
      if (match) return match;
    }
  }

  return { folders: [] };
}

/**
 * Computes tiered environment variables following the exact hierarchical order:
 * Folder / Local Request Context (highest) -> Active Collection Environment -> Global Workspace Env (baseline).
 *
 * Lookup Priority:
 * 1. Folder / Local Request Context (overrides everything below)
 * 2. Active Collection Environment (overrides global)
 * 3. Global Workspace Env (baseline defaults)
 */
export function computeTieredEnvironment(params: {
  globalEnv?: Environment | Record<string, string> | null;
  collection?: CourierCollection | null;
  folders?: CourierFolder[] | null;
  localRequestContext?: Array<KeyValuePair> | Record<string, string> | null;
}): {
  variables: Record<string, string>;
  scopeAudit: VariableScopeEntry[];
} {
  const { globalEnv, collection, folders, localRequestContext } = params;
  const merged: Record<string, string> = {};
  const allEntries: VariableScopeEntry[] = [];

  // Helper to ingest variables
  const ingestVars = (
    tier: 'local' | 'folder' | 'collection' | 'global',
    scopeName: string,
    vars?: Array<KeyValuePair | EnvironmentVariable> | Record<string, string> | null
  ) => {
    if (!vars) return;
    if (Array.isArray(vars)) {
      for (const v of vars) {
        if (v.enabled && v.key && v.key.trim()) {
          const k = v.key.trim();
          allEntries.push({
            tier,
            scopeName,
            key: k,
            value: v.value ?? '',
            enabled: true,
          });
        }
      }
    } else if (typeof vars === 'object') {
      for (const [k, v] of Object.entries(vars)) {
        if (k && k.trim()) {
          allEntries.push({
            tier,
            scopeName,
            key: k.trim(),
            value: String(v ?? ''),
            enabled: true,
          });
        }
      }
    }
  };

  // 1. Tier: Global Workspace Environment (Baseline)
  if (globalEnv) {
    if ('variables' in globalEnv && Array.isArray(globalEnv.variables)) {
      ingestVars('global', globalEnv.name || 'Global Workspace Env', globalEnv.variables);
    } else {
      ingestVars('global', 'Global Workspace Env', globalEnv as Record<string, string>);
    }
  }

  // 2. Tier: Active Collection Environment (Overrides Global Workspace Env)
  if (collection && collection.variables) {
    ingestVars('collection', collection.name ? `${collection.name} Collection` : 'Active Collection', collection.variables);
  }

  // 3. Tier: Folder Context (From parent down to nested child folder, overrides Collection)
  if (folders && folders.length > 0) {
    for (const f of folders) {
      if (f.variables) {
        ingestVars('folder', f.name ? `${f.name} Folder` : 'Folder Scope', f.variables);
      }
    }
  }

  // 4. Tier: Local Request Context (Path variables / local parameters, highest precedence)
  if (localRequestContext) {
    ingestVars('local', 'Local Request Context', localRequestContext);
  }

  // Build the final merged dictionary following the priority chain:
  // Global -> Collection -> Folder -> Local Request
  for (const entry of allEntries) {
    merged[entry.key] = entry.value;
  }

  // Mark audit entries as active or overridden
  const scopeAudit = allEntries.map(entry => ({
    ...entry,
    isOverridden: merged[entry.key] !== entry.value,
  }));

  return { variables: merged, scopeAudit };
}

/**
 * Resolves the full tiered variable dictionary for a specific request ID,
 * automatically traversing its Folder, Collection, and Global Workspace scopes.
 */
export function resolveRequestEnvironment(
  collections: CourierCollection[],
  requestId: string,
  globalEnv?: Environment | Record<string, string> | null
): {
  variables: Record<string, string>;
  hierarchy: RequestHierarchy;
  scopeAudit: VariableScopeEntry[];
} {
  const hierarchy = findRequestHierarchy(collections, requestId);
  const localParams = hierarchy.request?.pathParams?.filter(p => p.enabled) || [];

  const { variables, scopeAudit } = computeTieredEnvironment({
    globalEnv,
    collection: hierarchy.collection,
    folders: hierarchy.folders,
    localRequestContext: localParams,
  });

  return { variables, hierarchy, scopeAudit };
}

/**
 * Resolves interpolation tags `{{variableName}}` in a given string using the
 * computed hierarchical dictionary (Folder/Local -> Collection -> Global).
 */
export function resolveInterpolation(
  text: string,
  tieredVariables: Record<string, string> = {}
): string {
  if (typeof text !== 'string') return text;

  return text.replace(/\{\{([^{}]+)\}\}/g, (match, rawKey) => {
    const key = rawKey.trim();

    // 1. Dynamic built-in generators (e.g. {{$guid}}, {{$timestamp}})
    if (dynamicGenerators[key]) {
      return dynamicGenerators[key]();
    }

    // 2. Layered scope lookup (Folder/Local -> Collection -> Global)
    if (tieredVariables[key] !== undefined && tieredVariables[key] !== null) {
      return tieredVariables[key];
    }

    // 3. Fallback: preserve original placeholder if unresolvable
    return match;
  });
}

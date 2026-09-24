import type { HttpResponse } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScriptLog {
  level: 'info' | 'warn' | 'error' | 'pass' | 'fail';
  message: string;
}

export interface ScriptResult {
  logs: ScriptLog[];
  envMutations: Record<string, string>;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// expect() DSL
// ─────────────────────────────────────────────────────────────────────────────

function createExpect(value: any, logs: ScriptLog[]) {
  const label = JSON.stringify(value);
  return {
    /** expect(x).toBe(y) — strict equality */
    toBe(expected: any) {
      if (value === expected) {
        logs.push({ level: 'pass', message: `✔ expect(${label}).toBe(${JSON.stringify(expected)})` });
      } else {
        logs.push({ level: 'fail', message: `✘ expect(${label}).toBe(${JSON.stringify(expected)}) — got ${label}` });
      }
    },
    /** expect(x).toEqual(y) — deep equality (JSON round-trip) */
    toEqual(expected: any) {
      const a = JSON.stringify(value);
      const b = JSON.stringify(expected);
      if (a === b) {
        logs.push({ level: 'pass', message: `✔ expect(…).toEqual(${b})` });
      } else {
        logs.push({ level: 'fail', message: `✘ expect(…).toEqual(${b}) — got ${a}` });
      }
    },
    /** expect(x).toContain(y) — string/array includes */
    toContain(sub: any) {
      const ok = typeof value === 'string'
        ? value.includes(String(sub))
        : Array.isArray(value) && value.includes(sub);
      if (ok) {
        logs.push({ level: 'pass', message: `✔ expect(…).toContain(${JSON.stringify(sub)})` });
      } else {
        logs.push({ level: 'fail', message: `✘ expect(…).toContain(${JSON.stringify(sub)}) — not found in ${label}` });
      }
    },
    /** expect(n).toBeLessThan(max) */
    toBeLessThan(max: number) {
      if (Number(value) < max) {
        logs.push({ level: 'pass', message: `✔ expect(${label}).toBeLessThan(${max})` });
      } else {
        logs.push({ level: 'fail', message: `✘ expect(${label}).toBeLessThan(${max})` });
      }
    },
    /** expect(n).toBeGreaterThan(min) */
    toBeGreaterThan(min: number) {
      if (Number(value) > min) {
        logs.push({ level: 'pass', message: `✔ expect(${label}).toBeGreaterThan(${min})` });
      } else {
        logs.push({ level: 'fail', message: `✘ expect(${label}).toBeGreaterThan(${min})` });
      }
    },
    /** expect(x).toBeTruthy() */
    toBeTruthy() {
      if (value) {
        logs.push({ level: 'pass', message: `✔ expect(${label}).toBeTruthy()` });
      } else {
        logs.push({ level: 'fail', message: `✘ expect(${label}).toBeTruthy()` });
      }
    },
    /** expect(x).toBeDefined() */
    toBeDefined() {
      if (value !== undefined && value !== null) {
        logs.push({ level: 'pass', message: `✔ expect(${label}).toBeDefined()` });
      } else {
        logs.push({ level: 'fail', message: `✘ expect(${label}).toBeDefined()` });
      }
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executes a user-authored post-response script in a sandboxed Function scope.
 *
 * Globals injected into the script context:
 *   response         — { status, statusText, headers, data, timeMs, sizeBytes }
 *   expect(value)    — returns chainable assertion object
 *   setEnv(k, v)     — writes to the active environment (returned in envMutations)
 *   getEnv(k)        — reads current env variable by key (from envVars param)
 *   console.log/warn/error — captured into logs[]
 *   pm.response      — Postman-compat alias (pm.response.code, pm.response.json())
 *   pm.environment.set/get — Postman-compat alias for setEnv/getEnv
 *   pm.test(name, fn) — Postman-compat test block
 */
export function runScript(
  script: string,
  response: HttpResponse,
  envVars: Record<string, string> = {},
): ScriptResult {
  const logs: ScriptLog[] = [];
  const envMutations: Record<string, string> = {};

  // ── Sandbox helpers ────────────────────────────────────────────────────────

  const setEnv = (key: string, value: string) => {
    envMutations[key] = String(value);
    logs.push({ level: 'info', message: `setEnv("${key}", "${value}")` });
  };

  const getEnv = (key: string): string => envVars[key] ?? '';

  const consoleSandbox = {
    log:   (...args: any[]) => logs.push({ level: 'info',  message: args.map(String).join(' ') }),
    warn:  (...args: any[]) => logs.push({ level: 'warn',  message: args.map(String).join(' ') }),
    error: (...args: any[]) => logs.push({ level: 'error', message: args.map(String).join(' ') }),
  };

  // Safe, serialisable response snapshot
  const responseSandbox = {
    status:     response.status,
    statusText: response.statusText,
    headers:    response.headers,
    data:       response.data,
    timeMs:     response.timeMs,
    sizeBytes:  response.sizeBytes,
    json: ()    => response.data,
    text: ()    => typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
  };

  // Postman-compat pm object
  const pm = {
    response: {
      code:       response.status,
      status:     response.statusText,
      headers:    response.headers,
      responseTime: response.timeMs,
      json:       () => response.data,
      text:       () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
    },
    environment: {
      set: setEnv,
      get: getEnv,
    },
    test: (name: string, fn: () => void) => {
      try {
        fn();
        logs.push({ level: 'pass', message: `✔ ${name}` });
      } catch (e: any) {
        logs.push({ level: 'fail', message: `✘ ${name}: ${e?.message ?? e}` });
      }
    },
  };

  // ── Execute ─────────────────────────────────────────────────────────────────

  try {
    // Build the sandboxed function. All helper names become parameters so they
    // shadow any outer globals the user might accidentally reference.
    const sandboxFn = new Function(
      'response',
      'expect',
      'setEnv',
      'getEnv',
      'console',
      'pm',
      // Block raw DOM / fetch access inside scripts
      'window',
      'document',
      'fetch',
      script,
    );

    sandboxFn(
      responseSandbox,
      (value: any) => createExpect(value, logs),
      setEnv,
      getEnv,
      consoleSandbox,
      pm,
      undefined, // window  → undefined
      undefined, // document → undefined
      undefined, // fetch   → undefined
    );
  } catch (err: any) {
    return { logs, envMutations, error: `Script error: ${err?.message ?? String(err)}` };
  }

  return { logs, envMutations };
}

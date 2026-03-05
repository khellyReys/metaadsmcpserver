/**
 * Centralized env access - reads via window.__getEnv__ (injected by Vite, env in closure)
 * or import.meta.env. Values are not attached to window to avoid exposing keys in dev console.
 */
export function getEnv(): Record<string, string | undefined> {
  const meta = import.meta.env as Record<string, string | undefined>;
  const getInjected =
    typeof window !== 'undefined' && typeof (window as unknown as { __getEnv__?: (k: string) => string | undefined }).__getEnv__ === 'function'
      ? (window as unknown as { __getEnv__(k: string): string | undefined }).__getEnv__
      : null;
  const out: Record<string, string | undefined> = { ...meta };
  if (getInjected) {
    const keys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_FACEBOOK_APP_ID', 'VITE_APP_URL', 'VITE_MCP_URL'];
    for (const k of keys) {
      const v = getInjected(k);
      if (v !== undefined) out[k] = v;
    }
  }
  return out;
}

export function getEnvVar(key: string): string | undefined {
  if (typeof window !== 'undefined' && typeof (window as unknown as { __getEnv__?: (k: string) => string | undefined }).__getEnv__ === 'function') {
    const v = (window as unknown as { __getEnv__(k: string): string | undefined }).__getEnv__(key);
    if (v !== undefined && v !== '') return v;
  }
  const meta = import.meta.env as Record<string, string | undefined>;
  const val = meta[key];
  return val === '' ? undefined : val;
}

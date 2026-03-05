import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse .env - try multiple locations (cwd, config dir) for reliability
function loadEnvFromFile(dir: string): Record<string, string> {
  const envPath = path.resolve(dir, '.env');
  const out: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return out;
  let content = fs.readFileSync(envPath, 'utf-8');
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1); // strip BOM
  const lines = content.split(/\r?\n/).flatMap((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return [];
    if ((t.match(/VITE_/g) || []).length > 1)
      return t.split(/\s+(?=VITE_)/).map((s) => s.trim()).filter(Boolean);
    return [t];
  });
  for (const trimmed of lines) {
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    out[key] = val;
  }
  return out;
}

// All client env keys (injected in closure only; not all are in define).
const SAFE_CLIENT_KEYS = new Set([
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_FACEBOOK_APP_ID',
  'VITE_APP_URL',
  'VITE_MCP_URL',
]);

// Keys that must NOT be in the bundle (only in closure) - avoid string literals in JS.
const CLOSURE_ONLY_KEYS = new Set(['VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL']);

function loadViteEnv(): Record<string, string> {
  const env = { ...loadEnvFromFile(process.cwd()), ...loadEnvFromFile(__dirname) };
  const viteEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(env))
    if (k.startsWith('VITE_') && v && SAFE_CLIENT_KEYS.has(k)) viteEnv[k] = v;
  return viteEnv;
}

const viteEnv = loadViteEnv();

// Plugin: inject env in a closure so keys/tokens are not visible in dev console (window.__ENV__ dump)
function injectEnvPlugin(env: Record<string, string>) {
  const escaped = JSON.stringify(env).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const script =
    `(function(){var e=${escaped};window.__getEnv__=function(k){return e[k]!==undefined?e[k]:undefined;};})();`;
  return {
    name: 'inject-env',
    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        return html.replace('<head>', `<head><script>${script}</script>`);
      },
    },
  };
}

export default defineConfig(() => ({
  plugins: [react(), injectEnvPlugin(viteEnv)],
  define: Object.fromEntries(
    Object.entries(viteEnv)
      .filter(([k]) => !CLOSURE_ONLY_KEYS.has(k))
      .map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)])
  ),
  envDir: __dirname,
  root: __dirname,
  server: (() => {
    const keyPath = path.join(__dirname, 'localhost-key.pem');
    const certPath = path.join(__dirname, 'localhost-cert.pem');
    const hasCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);
    return {
      ...(hasCerts && {
        https: {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        },
      }),
      port: 3000,
      host: true,
    };
  })(),
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
}));
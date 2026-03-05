import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Copy, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { getEnvVar } from '../lib/env';

interface CredentialsModalProps {
  serverId: string;
  serverAccessToken: string;
  isOpen: boolean;
  onClose: () => void;
}

const getMcpBaseUrl = () => {
  const envUrl = getEnvVar('VITE_MCP_URL');
  if (envUrl && envUrl.includes('metaadsmcpserver-1.onrender.com')) {
    return envUrl.replace('metaadsmcpserver-1.onrender.com', 'metaadsmcpserver.onrender.com');
  }
  if (envUrl && /^http:\/\/localhost(:\d+)?/.test(envUrl)) {
    return envUrl.replace('http://', 'https://');
  }
  return envUrl || 'https://metaadsmcpserver.onrender.com';
};

const CredentialsModal: React.FC<CredentialsModalProps> = ({ serverId, serverAccessToken, isOpen, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); };
  }, []);

  const mcpBaseUrl = useMemo(() => getMcpBaseUrl(), []);
  const sseBaseUrl = `${mcpBaseUrl}/api/sse`;
  const mcpHttpBaseUrl = `${mcpBaseUrl}/api/mcp`;

  const sseToken = useMemo(() => btoa(`${serverId}:${serverAccessToken}`), [serverId, serverAccessToken]);
  const sseUrl = useMemo(() => `${sseBaseUrl}?token=${encodeURIComponent(sseToken)}`, [sseBaseUrl, sseToken]);
  const mcpHttpUrl = useMemo(() => `${mcpHttpBaseUrl}?token=${encodeURIComponent(sseToken)}`, [mcpHttpBaseUrl, sseToken]);

  const copyField = (txt: string, field: string) => async () => {
    try { await navigator.clipboard.writeText(txt); } catch { /* fallback */ }
    setCopiedField(field);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black bg-opacity-60" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Connection Credentials</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Warning */}
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Copy and store these credentials securely. Do not share them publicly.</span>
          </div>

          {/* Streamable HTTP */}
          <div className="rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800">
            <div className="bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 border-b border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Streamable HTTP</h3>
                <span className="text-xs font-medium px-2 py-0.5 bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-full">Recommended</span>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                One URL for all tools and resources, with streaming. Use this endpoint in your MCP client.
              </p>
            </div>
            <div className="bg-emerald-50/40 dark:bg-emerald-900/10 p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Option 1: Endpoint + Token</label>
                <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                  <input readOnly value={mcpHttpBaseUrl} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0" />
                  <button
                    onClick={copyField(mcpHttpBaseUrl, 'http-base')}
                    className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex-shrink-0"
                  >
                    {copiedField === 'http-base' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Token</label>
                <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                  <input readOnly value={'●'.repeat(8)} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0 tracking-widest" />
                  <button
                    onClick={copyField(sseToken, 'http-token')}
                    className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex-shrink-0"
                  >
                    {copiedField === 'http-token' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Use with header: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono">Authorization: Bearer &lt;token&gt;</code>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Option 2: Full URL with token</label>
                <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                  <input readOnly value={`${mcpHttpBaseUrl}?token=${'●'.repeat(8)}`} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0" />
                  <button
                    onClick={copyField(mcpHttpUrl, 'http-full')}
                    className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex-shrink-0"
                  >
                    {copiedField === 'http-full' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
          </div>

          {/* SSE (legacy) */}
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">SSE</h3>
                <span className="text-xs font-medium px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">Legacy</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Server-Sent Events transport for older MCP clients that don't support Streamable HTTP.
              </p>
            </div>
            <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Option 1: Endpoint + Token</label>
                <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                  <input readOnly value={sseBaseUrl} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0" />
                  <button
                    onClick={copyField(sseBaseUrl, 'sse-base')}
                    className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-slate-600 dark:hover:text-slate-400 transition-colors flex-shrink-0"
                  >
                    {copiedField === 'sse-base' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Token</label>
                <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                  <input readOnly value={'●'.repeat(8)} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0 tracking-widest" />
                  <button
                    onClick={copyField(sseToken, 'sse-token')}
                    className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-slate-600 dark:hover:text-slate-400 transition-colors flex-shrink-0"
                  >
                    {copiedField === 'sse-token' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Use with header: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono">Authorization: Bearer &lt;token&gt;</code>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Option 2: Full URL with token</label>
                <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                  <input readOnly value={`${sseBaseUrl}?token=${'●'.repeat(8)}`} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0" />
                  <button
                    onClick={copyField(sseUrl, 'sse-full')}
                    className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-slate-600 dark:hover:text-slate-400 transition-colors flex-shrink-0"
                  >
                    {copiedField === 'sse-full' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CredentialsModal;

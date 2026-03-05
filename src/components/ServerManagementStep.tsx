import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Plus, Server, X, AlertCircle, Trash2, KeyRound, Building2, CreditCard, FileText, Copy, Check, Info } from 'lucide-react';
import Spinner from './Spinner';
import CredentialsModal from './CredentialsModal';
import { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout, promiseWithTimeout } from '../lib/asyncUtils';
import { getEnvVar } from '../lib/env';
import { useVisibilityReset } from '../hooks/useVisibilityReset';

interface BusinessAccount {
  id: string;
  name: string;
  business_role: string;
  status: string;
  adAccountsCount: number;
}

interface ServerSettings {
  last_workspace?: {
    business_id?: string;
    business_name?: string;
    ad_account_id?: string;
    ad_account_name?: string;
    page_id?: string;
    page_name?: string;
  };
}

interface Server {
  id: string;
  name: string;
  access_token: string;
  created_at: string;
  is_active: boolean;
  settings?: ServerSettings;
  description?: string | null;
}

interface ServerManagementStepProps {
  currentUser: { id: string };
  servers: Server[];
  error: string;
  onServerSelected: (serverId: string) => void;
  onServerCreated: (server: Server) => void;
  onServerDeleted: (serverId: string) => void;
  onLogout: () => void;
  onClearError: () => void;
  supabase: SupabaseClient;
  facebookAccessToken: string;
  onCompleteServerSelection: (serverId: string, businessAccounts: BusinessAccount[]) => void;
  onRefreshServers?: () => Promise<void>;
  onContinueWithLastWorkspace?: (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    serverAccessToken: string
  ) => void;
}

export default function ServerManagementStep({
  currentUser,
  servers,
  error,
  onServerCreated,
  onServerDeleted,
  onClearError,
  supabase,
  facebookAccessToken,
  onCompleteServerSelection,
  onRefreshServers,
  onContinueWithLastWorkspace
}: ServerManagementStepProps) {
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  
  // Loading state for server selection
  const [loadingServerId, setLoadingServerId] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [loadingErrorServerId, setLoadingErrorServerId] = useState<string | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [serverToDelete, setServerToDelete] = useState<Server | null>(null);
  const [createServerError, setCreateServerError] = useState('');
  const [credentialsServer, setCredentialsServer] = useState<Server | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

  useEffect(() => {
    return () => { timerRefs.current.forEach(clearTimeout); };
  }, []);

  const safeTimeout = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timerRefs.current = timerRefs.current.filter(t => t !== id);
      fn();
    }, ms);
    timerRefs.current.push(id);
    return id;
  };

  const copyId = async (id: string, key: string) => {
    try { await navigator.clipboard.writeText(id); } catch { /* fallback */ }
    setCopiedId(key);
    safeTimeout(() => setCopiedId(null), 1500);
  };

  useVisibilityReset(() => {
    setLoadingServerId('');
    setLoadingProgress(0);
    setLoadingMessage('');
    setLoadingError('');
    setLoadingErrorServerId(null);
    setIsCreatingServer(false);
    setDeletingServerId(null);
    setCreateServerError('');
  });

  const ensureSessionReady = async (): Promise<string> => {
    try {
      const result = await promiseWithTimeout(supabase.auth.getSession(), 2000);
      const { data, error: sessionError } = result;
      const sessionUserId = data?.session?.user?.id;
      if (sessionError || !sessionUserId) {
        if (currentUser?.id) return currentUser.id;
        throw new Error('Session is not ready yet. Please wait a moment and try again.');
      }
      return sessionUserId;
    } catch (e) {
      if (currentUser?.id) return currentUser.id;
      throw e;
    }
  };

  const getStoredAccessToken = (): string | null => {
    try {
      const raw = localStorage.getItem('authData');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { access_token?: string };
      return parsed?.access_token || null;
    } catch {
      return null;
    }
  };

  const rpcViaRest = async <T,>(fn: string, payload: Record<string, unknown>, timeoutMs: number): Promise<T> => {
    const token = getStoredAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (supabaseAnonKey) headers.apikey = supabaseAnonKey;
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      timeoutMs,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`RPC ${fn} failed (${response.status}): ${text.slice(0, 200)}`);
    }
    if (!text) return null as T;
    return JSON.parse(text) as T;
  };

  // Resolve missing business/ad account/page names from Graph API and persist so all server cards show names.
  const backfillMissingNamesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!facebookAccessToken || !onRefreshServers || servers.length === 0) return;
    const needsBackfill = servers.filter((server) => {
      const ws = server.settings?.last_workspace;
      if (!ws?.business_id || !ws?.ad_account_id || !ws?.page_id) return false;
      const missing = !ws.business_name || !ws.ad_account_name || !ws.page_name;
      if (!missing) return false;
      if (backfillMissingNamesRef.current.has(server.id)) return false;
      return true;
    });
    if (needsBackfill.length === 0) return;
    (async () => {
      for (const server of needsBackfill) {
        backfillMissingNamesRef.current.add(server.id);
        const ws = server.settings?.last_workspace!;
        let business_name = ws.business_name ?? '';
        let ad_account_name = ws.ad_account_name ?? '';
        let page_name = ws.page_name ?? '';
        const token = encodeURIComponent(facebookAccessToken);
        try {
          if (!business_name && ws.business_id) {
            const r = await fetchWithTimeout(
              `https://graph.facebook.com/v18.0/${encodeURIComponent(ws.business_id)}?fields=name&access_token=${token}`,
              { timeoutMs: 10000 }
            );
            const d = await r.json();
            if (d?.name) business_name = d.name;
          }
          if (!ad_account_name && ws.ad_account_id) {
            const adId = String(ws.ad_account_id).startsWith('act_') ? ws.ad_account_id : `act_${ws.ad_account_id}`;
            const r = await fetchWithTimeout(
              `https://graph.facebook.com/v18.0/${encodeURIComponent(adId)}?fields=name&access_token=${token}`,
              { timeoutMs: 10000 }
            );
            const d = await r.json();
            if (d?.name) ad_account_name = d.name;
          }
          if (!page_name && ws.page_id) {
            const r = await fetchWithTimeout(
              `https://graph.facebook.com/v18.0/${encodeURIComponent(ws.page_id)}?fields=name&access_token=${token}`,
              { timeoutMs: 10000 }
            );
            const d = await r.json();
            if (d?.name) page_name = d.name;
          }
          if (business_name || ad_account_name || page_name) {
            await rpcViaRest('update_server_settings', {
              p_server_id: server.id,
              p_settings: {
                last_workspace: {
                  business_id: ws.business_id,
                  business_name: business_name || ws.business_name,
                  ad_account_id: ws.ad_account_id,
                  ad_account_name: ad_account_name || ws.ad_account_name,
                  page_id: ws.page_id,
                  page_name: page_name || ws.page_name,
                },
              },
            }, 12000);
            onRefreshServers().catch(() => {});
          }
        } catch {
          backfillMissingNamesRef.current.delete(server.id);
        }
      }
    })();
  }, [servers, facebookAccessToken, onRefreshServers]);

  const handleCreateServer = async () => {
    if (!serverName.trim() || !currentUser) return;
    const trimmedServerName = serverName.trim();
    const trimmedDescription = serverDescription.trim();

    setIsCreatingServer(true);
    setCreateServerError('');
    onClearError();

    try {
      const activeUserId = await ensureSessionReady();
      const { data: serverData } = await promiseWithTimeout(
        (async () => {
          const data = await rpcViaRest<unknown>('create_server_with_session', {
            p_user_id: activeUserId,
            p_server_name: trimmedServerName,
            p_description: trimmedDescription || null,
            p_expires_hours: 24 * 30 // 30 days
          }, 30000);
          return { data, error: null };
        })(),
        90000
      );

      if (!serverData || (Array.isArray(serverData) && serverData.length === 0)) {
        throw new Error('No server data returned');
      }

      const newServerData = Array.isArray(serverData) ? serverData[0] : serverData;
      const newServerId = newServerData.server_id;
      const newServer: Server = {
        id: newServerId,
        name: trimmedServerName,
        access_token: newServerData.session_token,
        created_at: new Date().toISOString(),
        is_active: true,
        description: trimmedDescription || undefined
      };

      onServerCreated(newServer);
      if (onRefreshServers) {
        void onRefreshServers().catch(() => {});
      }
      setServerName('');
      setServerDescription('');
      setShowServerModal(false);

      if (trimmedDescription) {
        void supabase.rpc('update_server_description', {
          p_server_id: newServerId,
          p_description: trimmedDescription
        });
      }

      handleSelectServer(newServerId);

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create server';
      const isTimeout = msg.includes('timed out');
      if (isTimeout && onRefreshServers) {
        void onRefreshServers().catch(() => {});
      }
      setCreateServerError(
        isTimeout
          ? 'Create request timed out. We refreshed your servers list automatically. If it is still missing, try creating again.'
          : msg
      );
    } finally {
      setIsCreatingServer(false);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!currentUser) return;
    setDeletingServerId(serverId);
    onClearError();
    try {
      await ensureSessionReady();
      await promiseWithTimeout(
        (async () => {
          await rpcViaRest<unknown>('delete_server', { p_server_id: serverId }, 20000);
          return { error: null };
        })(),
        45000
      );
      onServerDeleted(serverId);
      if (onRefreshServers) {
        void onRefreshServers().catch(() => {});
      }
      setServerToDelete(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete server';
      if (msg.includes('timed out') && onRefreshServers) {
        void onRefreshServers().catch(() => {});
      }
      onClearError();
      setLoadingError(msg);
      safeTimeout(() => setLoadingError(''), 3000);
    } finally {
      setDeletingServerId(null);
    }
  };

  // Enhanced server selection that handles the complete flow
  const handleSelectServer = async (serverId: string) => {
    // If this server is already in loading state (e.g. finally never ran), clear it so the button unsticks
    if (loadingServerId === serverId) {
      setLoadingServerId('');
      setLoadingProgress(0);
      setLoadingMessage('');
      return;
    }
    setLoadingServerId(serverId);
    setLoadingProgress(0);
    setLoadingMessage('Initializing...');
    setLoadingError('');
    onClearError();

    try {
      // Step 1: Validate server
      setLoadingProgress(10);
      setLoadingMessage('Validating server...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 2: Validate Facebook token
      setLoadingProgress(20);
      setLoadingMessage('Validating Facebook token...');
      
      if (!facebookAccessToken) {
        throw new Error('Facebook access token not available');
      }
      
      const meResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/me?access_token=${facebookAccessToken}`,
        { timeoutMs: 20000 }
      );
      const meData = await meResponse.json();

      if (meData.error) {
        throw new Error(`Facebook token invalid: ${meData.error.message}`);
      }
      
      // Step 3: Fetch Business Manager businesses only (no ad accounts or pages yet).
      // Note: me/businesses returns only Business Manager entities. Personal ad accounts
      // (no Business Manager) are not included; they appear in me/adaccounts only.
      setLoadingProgress(50);
      setLoadingMessage('Fetching business accounts...');

      const businessResponse = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/me/businesses?` +
          `access_token=${facebookAccessToken}&` +
          `fields=id,name,primary_page`,
        { timeoutMs: 20000 }
      );

      const businessData = await businessResponse.json();

      if (businessData.error) {
        throw new Error(`Facebook API error: ${businessData.error.message}`);
      }

      // Step 4: Build businesses list and sync to DB in background (do not block on Supabase - log evidence: flow hung between afterBusinesses and beforeOnComplete on upsert)
      setLoadingProgress(80);
      setLoadingMessage('Processing...');

      const businesses: BusinessAccount[] = [];

      if (businessData.data && businessData.data.length > 0) {
        for (const business of businessData.data) {
          businesses.push({
            id: business.id,
            name: business.name,
            business_role: 'Admin',
            status: 'active',
            adAccountsCount: 0,
          });
          // Fire-and-forget upsert so we never block the success path; business step gets data from parent, not DB
          void supabase
            .from('facebook_business_accounts')
            .upsert({
              id: business.id,
              user_id: currentUser.id,
              name: business.name,
              business_role: 'Admin',
              status: 'active',
              primary_page_id: business.primary_page?.id,
            });
        }
      }

      // Step 5: Complete
      setLoadingProgress(100);
      setLoadingMessage('Complete! Redirecting...');
      
      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onCompleteServerSelection(serverId, businesses);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLoadingError(`Failed to load business accounts: ${errorMessage}. Please logout and try again!`);
      setLoadingErrorServerId(serverId);
      safeTimeout(() => {
        setLoadingError('');
        setLoadingErrorServerId(null);
      }, 8000);
    } finally {
      // Always clear loading state so the button never gets stuck (success or error)
      setLoadingServerId('');
      setLoadingProgress(0);
      setLoadingMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header: step progress, title, description */}
        <div className="mb-8">
          {/* Step Progress Indicator: 1 Server → 2 Business → 3 Ad Account → 4 Page → 5 Tools */}
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 mb-6">
            {/* 1. Server (current) */}
            <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-blue-100 dark:bg-blue-900/40">
                1
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Server</span>
            </div>
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            {/* 2. Business */}
            <div className="flex items-center space-x-1.5 text-gray-400 dark:text-gray-500">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-gray-100 dark:bg-gray-700">
                2
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Business</span>
            </div>
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            {/* 3. Ad Account */}
            <div className="flex items-center space-x-1.5 text-gray-400 dark:text-gray-500">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-gray-100 dark:bg-gray-700">
                3
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Ad Account</span>
            </div>
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            {/* 4. Page */}
            <div className="flex items-center space-x-1.5 text-gray-400 dark:text-gray-500">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-gray-100 dark:bg-gray-700">
                4
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Page</span>
            </div>
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            {/* 5. Tools */}
            <div className="flex items-center space-x-1.5 text-gray-400 dark:text-gray-500">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-gray-100 dark:bg-gray-700">
                5
              </div>
              <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Tools</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">Your Servers</h1>
          <p className="text-gray-600 dark:text-gray-300 text-center">Create and manage your Facebook ads automation servers</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3 max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Servers List */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Your Servers ({servers.length})
            </h2>
            <button
              onClick={() => setShowServerModal(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Server</span>
            </button>
          </div>

          {servers.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Server className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Servers Yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Create your first MCP server to start automating Facebook ads.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {servers.map((server) => {
                const isLoading = loadingServerId === server.id;
                const ws = server.settings?.last_workspace;
                const isFullyConfigured = !!(ws?.business_id && ws?.ad_account_id && ws?.page_id);
                
                return (
                  <div
                    key={server.id}
                    className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 bg-gradient-to-br ${isFullyConfigured ? 'from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30' : 'from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30'} rounded-lg flex items-center justify-center`}>
                          <Server className={`w-6 h-6 ${isFullyConfigured ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{server.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            Created {new Date(server.created_at).toLocaleDateString()}
                            {server.description?.trim() ? (
                              <span
                                className="inline-flex text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-help"
                                title={server.description.trim()}
                              >
                                <Info className="w-3.5 h-3.5 shrink-0" aria-hidden />
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isFullyConfigured ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                            Draft
                          </span>
                        )}
                        <button
                          onClick={() => setCredentialsServer(server)}
                          disabled={isLoading || loadingServerId !== ''}
                          className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="View credentials"
                          aria-label="View credentials"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setServerToDelete(server)}
                          disabled={isLoading || loadingServerId !== '' || deletingServerId === server.id}
                          className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete server"
                          aria-label="Delete server"
                        >
                          {deletingServerId === server.id ? (
                            <Spinner size="xs" variant="loader" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Connected Setup */}
                    <div className="mb-4 space-y-1.5">
                      <div>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-0.5 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          Business ID
                        </p>
                        {ws?.business_id ? (
                          <div className="flex items-center justify-between gap-2 text-xs pl-5">
                            <span className="text-gray-700 dark:text-gray-300 truncate">{ws.business_name || ws.business_id}</span>
                            <span className="flex items-center gap-1 flex-shrink-0">
                              {ws.business_name && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{ws.business_id}</span>}
                              <button onClick={() => copyId(ws.business_id!, `biz-${server.id}`)} className="p-0.5 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors" title="Copy ID">
                                {copiedId === `biz-${server.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic pl-5">Not connected</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-0.5 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5" />
                          Ad Account ID
                        </p>
                        {ws?.ad_account_id ? (
                          <div className="flex items-center justify-between gap-2 text-xs pl-5">
                            <span className="text-gray-700 dark:text-gray-300 truncate">{ws.ad_account_name || ws.ad_account_id}</span>
                            <span className="flex items-center gap-1 flex-shrink-0">
                              {ws.ad_account_name && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{ws.ad_account_id}</span>}
                              <button onClick={() => copyId(ws.ad_account_id!, `ad-${server.id}`)} className="p-0.5 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors" title="Copy ID">
                                {copiedId === `ad-${server.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic pl-5">Not connected</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-0.5 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          Page ID
                        </p>
                        {ws?.page_id ? (
                          <div className="flex items-center justify-between gap-2 text-xs pl-5">
                            <span className="text-gray-700 dark:text-gray-300 truncate">{ws.page_name || ws.page_id}</span>
                            <span className="flex items-center gap-1 flex-shrink-0">
                              {ws.page_name && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{ws.page_id}</span>}
                              <button onClick={() => copyId(ws.page_id!, `page-${server.id}`)} className="p-0.5 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors" title="Copy ID">
                                {copiedId === `page-${server.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic pl-5">Not connected</p>
                        )}
                      </div>
                    </div>

                    {/* Enhanced Select Button with Progress */}
                    {isLoading ? (
                      <div className="w-full">
                        <div className={`${loadingError ? 'bg-red-600' : 'bg-blue-600'} text-white py-2 px-4 rounded-lg mb-3 flex items-center justify-center space-x-2`}>
                          {loadingError ? (
                            <>
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-sm">Error occurred</span>
                            </>
                          ) : (
                            <>
                              <Spinner size="xs" variant="loader" className="text-white" />
                              <span className="text-sm">{loadingMessage}</span>
                            </>
                          )}
                        </div>
                        
                        {/* Progress Bar */}
                        {!loadingError && (
                          <>
                            <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${loadingProgress}%` }}
                              />
                            </div>
                            <div className="text-center mt-1">
                              <span className="text-xs text-gray-500 dark:text-gray-400">{loadingProgress}% complete</span>
                            </div>
                          </>
                        )}
                        
                        {/* Error Message */}
                        {loadingError && (
                          <div className="text-center mt-2">
                            <p className="text-xs text-red-600 dark:text-red-400">{loadingError}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full space-y-2">
                        {onContinueWithLastWorkspace && (
                          <button
                            type="button"
                            disabled={!isFullyConfigured}
                            onClick={() =>
                              onContinueWithLastWorkspace(
                                server.id,
                                ws?.business_id ?? '',
                                ws?.ad_account_id ?? '',
                                ws?.page_id ?? '',
                                server.access_token
                              )
                            }
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2 px-4 rounded-lg transition-all flex items-center justify-center space-x-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span>Open Tools</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleSelectServer(server.id)}
                          disabled={loadingServerId !== ''}
                          className="w-full py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                        >
                          <span>{isFullyConfigured ? 'Reconfigure' : 'Configure Server'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        {loadingError && loadingErrorServerId === server.id && (
                          <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                            <p className="text-xs text-red-600 dark:text-red-400">{loadingError}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Server Creation Modal */}
        {/* Delete server confirmation modal */}
        {serverToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl border border-gray-200 dark:border-gray-600">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete server?</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">This action cannot be undone.</p>
                  </div>
                </div>
                <button
                  onClick={() => !deletingServerId && setServerToDelete(null)}
                  disabled={!!deletingServerId}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 p-1"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete <span className="font-medium text-gray-900 dark:text-gray-100">&quot;{serverToDelete.name}&quot;</span>? All data associated with this server will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setServerToDelete(null)}
                  disabled={!!deletingServerId}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteServer(serverToDelete.id)}
                  disabled={!!deletingServerId}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingServerId === serverToDelete.id ? (
                    <>
                      <Spinner size="xs" variant="loader" className="text-white" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showServerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create New Server</h3>
                <button
                  onClick={() => setShowServerModal(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Server Name
                </label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g., Main Ads Server"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={serverDescription}
                  onChange={(e) => setServerDescription(e.target.value)}
                  placeholder="e.g., Production ads for Brand X"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                />
              </div>

              {createServerError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{createServerError}</p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => { setShowServerModal(false); setCreateServerError(''); }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateServer}
                  disabled={!serverName.trim() || isCreatingServer}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isCreatingServer ? (
                    <>
                      <Spinner size="xs" variant="loader" className="text-white" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Server</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Credentials Modal */}
        {credentialsServer && (
          <CredentialsModal
            serverId={credentialsServer.id}
            serverAccessToken={credentialsServer.access_token}
            isOpen={true}
            onClose={() => setCredentialsServer(null)}
          />
        )}
      </div>
    </div>
  );
}
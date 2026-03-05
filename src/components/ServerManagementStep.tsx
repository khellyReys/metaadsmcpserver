import React, { useState, useEffect } from 'react';
import { ArrowRight, Plus, Server, X, AlertCircle, Trash2 } from 'lucide-react';
import Spinner from './Spinner';
import { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout, promiseWithTimeout } from '../lib/asyncUtils';
import { useVisibilityReset } from '../hooks/useVisibilityReset';

interface BusinessAccount {
  id: string;
  name: string;
  business_role: string;
  status: string;
  adAccountsCount: number;
}

interface Server {
  id: string;
  name: string;
  access_token: string;
  created_at: string;
  is_active: boolean;
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
  // Updated interface to match the new flow
  onCompleteServerSelection: (serverId: string, businessAccounts: BusinessAccount[]) => void;
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
  onCompleteServerSelection
}: ServerManagementStepProps) {
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverName, setServerName] = useState('');
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  
  // Loading state for server selection
  const [loadingServerId, setLoadingServerId] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [loadingErrorServerId, setLoadingErrorServerId] = useState<string | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [serverToDelete, setServerToDelete] = useState<Server | null>(null);

  useVisibilityReset(() => {
    setLoadingServerId('');
    setLoadingProgress(0);
    setLoadingMessage('');
    setLoadingError('');
    setLoadingErrorServerId(null);
    setIsCreatingServer(false);
    setDeletingServerId(null);
  });

  const handleCreateServer = async () => {
    if (!serverName.trim() || !currentUser) return;

    setIsCreatingServer(true);
    onClearError();

    try {
      const { data: serverData, error: serverError } = await promiseWithTimeout(
        (async () => {
          const r = await supabase.rpc('create_server_with_session', {
            p_user_id: currentUser.id,
            p_server_name: serverName.trim(),
            p_description: null,
            p_expires_hours: 24 * 30 // 30 days
          });
          return r;
        })(),
        25000
      );

      if (serverError) {
        throw new Error('Failed to create server: ' + serverError.message);
      }

      if (!serverData || serverData.length === 0) {
        throw new Error('No server data returned');
      }

      const newServerData = serverData[0];
      const newServer: Server = {
        id: newServerData.server_id,
        name: serverName,
        access_token: newServerData.session_token,
        created_at: new Date().toISOString(),
        is_active: true
      };

      onServerCreated(newServer);
      setServerName('');
      setShowServerModal(false);

    } catch {
      // Error will be handled by parent component
    } finally {
      setIsCreatingServer(false);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!currentUser) return;
    setDeletingServerId(serverId);
    onClearError();
    try {
      const { error: deleteError } = await promiseWithTimeout(
        (async () => {
          const r = await supabase.rpc('delete_server', { p_server_id: serverId });
          return r;
        })(),
        15000
      );
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      onServerDeleted(serverId);
      setServerToDelete(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete server';
      onClearError();
      setLoadingError(msg);
      setTimeout(() => setLoadingError(''), 3000);
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
      setTimeout(() => {
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
                
                return (
                  <div
                    key={server.id}
                    className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 rounded-lg flex items-center justify-center">
                          <Server className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{server.name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Created {new Date(server.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                          Active
                        </span>
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

                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">Server ID:</p>
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono break-all text-gray-800 dark:text-gray-200">
                        {server.id}
                      </code>
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
                      <div className="w-full">
                        <button
                          onClick={() => handleSelectServer(server.id)}
                          disabled={loadingServerId !== ''}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span>Select Server</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        {/* Show error below button when loading was cleared by finally but error is still in state */}
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

              <div className="mb-6">
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

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowServerModal(false)}
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
      </div>
    </div>
  );
}
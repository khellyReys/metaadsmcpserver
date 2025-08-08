import React, { useState } from 'react';
import { ArrowRight, Plus, Server, X, AlertCircle, Loader } from 'lucide-react';
import { SupabaseClient } from '@supabase/supabase-js';

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
  currentUser: any;
  servers: Server[];
  error: string;
  onServerSelected: (serverId: string) => void;
  onServerCreated: (server: Server) => void;
  onLogout: () => void;
  onClearError: () => void;
  supabase: SupabaseClient;
  facebookAccessToken: string;
  onCompleteServerSelection: (serverId: string, businessAccounts: BusinessAccount[]) => void;
}

const ServerManagementStep: React.FC<ServerManagementStepProps> = ({
  currentUser,
  servers,
  error,
  onServerSelected,
  onServerCreated,
  onLogout,
  onClearError,
  supabase,
  facebookAccessToken,
  onCompleteServerSelection
}) => {
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverName, setServerName] = useState('');
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  
  // Loading state for server selection
  const [loadingServerId, setLoadingServerId] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingError, setLoadingError] = useState('');

  const handleCreateServer = async () => {
    if (!serverName.trim() || !currentUser) return;

    setIsCreatingServer(true);
    onClearError();

    try {
      const { data: serverData, error: serverError } = await supabase
        .rpc('create_server_with_session', {
          p_user_id: currentUser.id,
          p_server_name: serverName.trim(),
          p_description: null,
          p_expires_hours: 24 * 30 // 30 days
        });

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

    } catch (err) {
      // Error will be handled by parent component
    } finally {
      setIsCreatingServer(false);
    }
  };

  // Enhanced server selection that handles the complete flow
  const handleSelectServer = async (serverId: string) => {
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
      
      const meResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${facebookAccessToken}`);
      const meData = await meResponse.json();

      if (meData.error) {
        throw new Error(`Facebook token invalid: ${meData.error.message}`);
      }
      
      // Step 3: Fetch business accounts
      setLoadingProgress(30);
      setLoadingMessage('Fetching business accounts...');
      
      const businessResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?` +
        `access_token=${facebookAccessToken}&` +
        `fields=id,name,primary_page,owned_ad_accounts{account_id,name,account_status,currency,timezone_name}`
      );

      const businessData = await businessResponse.json();

      if (businessData.error) {
        throw new Error(`Facebook API error: ${businessData.error.message}`);
      }

      // Step 4: Process business data
      setLoadingProgress(50);
      setLoadingMessage('Processing business data...');

      const businesses: BusinessAccount[] = [];

      if (businessData.data && businessData.data.length > 0) {
        for (const business of businessData.data) {
          // Save business account to database
          const { error: businessError } = await supabase
            .from('facebook_business_accounts')
            .upsert({
              id: business.id,
              user_id: currentUser.id,
              name: business.name,
              business_role: 'Admin',
              status: 'active',
              primary_page_id: business.primary_page?.id,
            });

          if (businessError) {
            continue;
          }

          // Save owned ad accounts
          let adAccountCount = 0;
          if (business.owned_ad_accounts?.data) {
            for (const adAccount of business.owned_ad_accounts.data) {
              const { error: adAccountError } = await supabase
                .from('facebook_ad_accounts')
                .upsert({
                  id: adAccount.account_id,
                  business_account_id: business.id,
                  user_id: currentUser.id,
                  name: adAccount.name,
                  account_status: adAccount.account_status,
                  currency: adAccount.currency,
                  timezone_name: adAccount.timezone_name,
                  account_role: 'ADMIN',
                });

              if (!adAccountError) {
                adAccountCount++;
              }
            }
          }

          businesses.push({
            id: business.id,
            name: business.name,
            business_role: 'Admin',
            status: 'active',
            adAccountsCount: adAccountCount
          });
        }
      }

      // Step 5: Fetch additional ad accounts
      setLoadingProgress(70);
      setLoadingMessage('Fetching additional ad accounts...');

      const adAccountsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?` +
        `access_token=${facebookAccessToken}&` +
        `fields=account_id,name,account_status,business,currency,timezone_name`
      );

      const adAccountsData = await adAccountsResponse.json();

      if (!adAccountsData.error && adAccountsData.data) {
        const adAccountsByBusiness: { [key: string]: any[] } = {};
        
        for (const adAccount of adAccountsData.data) {
          if (adAccount.business) {
            const businessId = adAccount.business.id;
            
            await supabase
              .from('facebook_ad_accounts')
              .upsert({
                id: adAccount.account_id,
                business_account_id: businessId,
                user_id: currentUser.id,
                name: adAccount.name,
                account_status: adAccount.account_status,
                currency: adAccount.currency,
                timezone_name: adAccount.timezone_name,
                account_role: 'USER',
              }, {
                onConflict: 'id'
              });

            if (!adAccountsByBusiness[businessId]) {
              adAccountsByBusiness[businessId] = [];
            }
            adAccountsByBusiness[businessId].push(adAccount);
          }
        }

        // Update business accounts with accurate ad account counts
        businesses.forEach(business => {
          if (adAccountsByBusiness[business.id]) {
            business.adAccountsCount = Math.max(
              business.adAccountsCount,
              adAccountsByBusiness[business.id].length
            );
          }
        });
      }

      // Step 6: Fetch Facebook pages
      setLoadingProgress(85);
      setLoadingMessage('Fetching Facebook pages...');

      try {
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?` +
          `access_token=${facebookAccessToken}&` +
          `fields=id,name,category,access_token,picture,cover,is_published,verification_status,fan_count,website,about`
        );

        const pagesData = await pagesResponse.json();

        if (!pagesData.error && pagesData.data) {
          for (const page of pagesData.data) {
            await supabase
              .from('facebook_pages')
              .upsert({
                id: page.id,
                user_id: currentUser.id,
                name: page.name,
                category: page.category,
                access_token: page.access_token,
                page_role: 'ADMIN',
                picture_url: page.picture?.data?.url,
                cover_url: page.cover?.source,
                is_published: page.is_published !== false,
                verification_status: page.verification_status,
                followers_count: page.fan_count,
                website: page.website,
                about: page.about
              });
          }
        }
      } catch (pageError) {
        // Don't fail the entire process for page errors
      }

      // Step 7: Complete
      setLoadingProgress(100);
      setLoadingMessage('Complete! Redirecting...');
      
      // Wait a moment to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Call the parent with the fetched data
      onCompleteServerSelection(serverId, businesses);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setLoadingError(`Failed to load business accounts: ${errorMessage}`);
      
      // Reset loading state after showing error briefly
      setTimeout(() => {
        setLoadingServerId('');
        setLoadingProgress(0);
        setLoadingMessage('');
        setLoadingError('');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
        {currentUser && (
            <div className="flex items-center justify-center space-x-3 mb-4">
              {currentUser.user_metadata?.avatar_url && (
                <img 
                  src={currentUser.user_metadata.avatar_url} 
                  alt={currentUser.user_metadata?.full_name}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  Welcome, {currentUser.user_metadata?.full_name || currentUser.email}!
                </p>
                <p className="text-sm text-gray-600">{currentUser.email}</p>
              </div>
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Servers</h1>
          <p className="text-gray-600">Create and manage your Facebook ads automation servers</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Servers List */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
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
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Server className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Servers Yet</h3>
              <p className="text-gray-600 mb-4">
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
                    className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg flex items-center justify-center">
                          <Server className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{server.name}</h3>
                          <p className="text-sm text-gray-500">
                            Created {new Date(server.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-600 font-medium mb-1">Server ID:</p>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono break-all">
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
                              <Loader className="w-4 h-4 animate-spin" />
                              <span className="text-sm">{loadingMessage}</span>
                            </>
                          )}
                        </div>
                        
                        {/* Progress Bar */}
                        {!loadingError && (
                          <>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${loadingProgress}%` }}
                              />
                            </div>
                            <div className="text-center mt-1">
                              <span className="text-xs text-gray-500">{loadingProgress}% complete</span>
                            </div>
                          </>
                        )}
                        
                        {/* Error Message */}
                        {loadingError && (
                          <div className="text-center mt-2">
                            <p className="text-xs text-red-600">{loadingError}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSelectServer(server.id)}
                        disabled={loadingServerId !== ''}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>Select Server</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Server Creation Modal */}
        {showServerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Create New Server</h3>
                <button
                  onClick={() => setShowServerModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server Name
                </label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g., Main Ads Server"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowServerModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
};

export default ServerManagementStep;
import React, { useState, useEffect } from 'react';
import { ArrowRight, Building2, Users, CheckCircle, AlertCircle, RefreshCw, Server } from 'lucide-react';
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

interface BusinessSelectionStepProps {
  currentUser: any;
  selectedServer: string;
  servers: Server[];
  businessAccounts: BusinessAccount[];
  selectedBusiness: string;
  facebookAccessToken: string;
  error: string;
  onBusinessSelected: (businessId: string) => void;
  onBusinessSelectionChange: (businessId: string) => void;
  onBusinessAccountsChange: (accounts: BusinessAccount[]) => void;
  onBackToServers: () => void;
  onClearError: () => void;
  supabase: SupabaseClient;
}

const BusinessSelectionStep: React.FC<BusinessSelectionStepProps> = ({
  currentUser,
  selectedServer,
  servers,
  businessAccounts,
  selectedBusiness,
  facebookAccessToken,
  error,
  onBusinessSelected,
  onBusinessSelectionChange,
  onBusinessAccountsChange,
  onBackToServers,
  onClearError,
  supabase
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load business accounts when component mounts
  useEffect(() => {
    if (facebookAccessToken && currentUser && businessAccounts.length === 0) {
      fetchAndSaveBusinessAccounts();
    }
  }, [facebookAccessToken, currentUser]);

  // SSE Connection for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const initConnection = async () => {
      if (selectedServer && servers.length > 0) {
        const serverData = servers.find(s => s.id === selectedServer);
        if (serverData?.access_token) {
          console.log('Initializing SSE connection for server:', serverData.name);
          eventSource = connectToSSE(serverData.access_token);
        }
      }
    };

    initConnection();

    return () => {
      if (eventSource) {
        eventSource.close();
        console.log('SSE connection closed');
      }
    };
  }, [selectedServer, servers]);

  const fetchAndSaveBusinessAccounts = async () => {
    if (!facebookAccessToken || !currentUser) return;

    try {
      console.log('Fetching business accounts...');

      // Test token validity first
      const meResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${facebookAccessToken}`);
      const meData = await meResponse.json();

      if (meData.error) {
        throw new Error(`Facebook token invalid: ${meData.error.message}`);
      }

      // Fetch businesses
      const businessResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?` +
        `access_token=${facebookAccessToken}&` +
        `fields=id,name,primary_page,owned_ad_accounts{account_id,name,account_status,currency,timezone_name}`
      );

      const businessData = await businessResponse.json();

      if (businessData.error) {
        throw new Error(`Facebook API error: ${businessData.error.message}`);
      }

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
            console.error('Error saving business account:', businessError);
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

      // Fetch additional ad accounts user has access to
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

      // Fetch and save Facebook Pages
      await fetchAndSavePages();

      onBusinessAccountsChange(businesses);

    } catch (error) {
      console.error('Error fetching business accounts:', error);
      // Error handled by parent component
    }
  };

  const fetchAndSavePages = async () => {
    try {
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?` +
        `access_token=${facebookAccessToken}&` +
        `fields=id,name,category,access_token,picture,cover,is_published,verification_status,fan_count,website,about`
      );

      const pagesData = await pagesResponse.json();

      if (pagesData.error) {
        console.error('Facebook API error for pages:', pagesData.error);
        return;
      }

      if (pagesData.data) {
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
    } catch (error) {
      console.error('Error fetching pages:', error);
    }
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    onClearError();
    try {
      await fetchAndSaveBusinessAccounts();
    } catch (error) {
      // Error handled by parent component
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBusinessCardClick = (businessId: string) => {
    onBusinessSelectionChange(businessId);
  };

  const handleContinue = () => {
    if (selectedBusiness) {
      onBusinessSelected(selectedBusiness);
    }
  };

  // SSE Connection
  const connectToSSE = (accessToken: string) => {
    if (!accessToken) {
      return null;
    }

    const serverId = selectedServer;
    const tokenString = `${serverId}:${accessToken}`;
    const encodedToken = btoa(tokenString);
    
    const mcpServerUrl = import.meta.env.VITE_MCP_SERVER_URL || 'https://localhost:3000';
    const sseUrl = `${mcpServerUrl}/sse?token=${encodeURIComponent(encodedToken)}`;

    try {
      const eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        console.log('✅ SSE connection opened successfully');
        onClearError();
      };

      eventSource.onmessage = (event) => {
        console.log('📨 SSE message received:', event.data);
        
        try {
          if (event.data.startsWith('{')) {
            const data = JSON.parse(event.data);
            console.log('📋 SSE parsed JSON:', data);
          }
        } catch (parseError) {
          console.log('📝 Plain text SSE message:', event.data);
        }
      };

      eventSource.onerror = (event) => {
        console.error('💥 SSE connection error:', event);
        
        switch (eventSource.readyState) {
          case EventSource.CONNECTING:
            console.log('🔄 SSE attempting to reconnect...');
            break;
          case EventSource.CLOSED:
            console.log('🚫 SSE connection was closed');
            break;
        }
      };

      return eventSource;

    } catch (error) {
      console.error('💥 Failed to create SSE connection:', error);
      return null;
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

          {/* Selected Server Info */}
          {selectedServer && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
              <div className="flex items-center justify-center space-x-2">
                <Server className="w-5 h-5 text-blue-600" />
                <span className="text-blue-900 font-medium">
                  Server: {servers.find(s => s.id === selectedServer)?.name}
                </span>
              </div>
            </div>
          )}

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Business Manager Account</h1>
          <p className="text-gray-600">Choose the business account you want to manage ads for</p>
          
          <div className="flex items-center justify-center space-x-4 mt-4">
            <button
              onClick={handleRefreshData}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Data</span>
            </button>
            
            <button
              onClick={onBackToServers}
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-700 text-sm"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              <span>Back to Servers</span>
            </button>
          </div>
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

        {/* Business Accounts */}
        {businessAccounts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Business Accounts Found</h3>
            <p className="text-gray-600 mb-4">
              You don't have access to any Facebook Business Manager accounts.
            </p>
            <button
              onClick={handleRefreshData}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-2 text-blue-600 hover:underline"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Try refreshing</span>
            </button>
          </div>
        ) : (
          <>
            {/* Business Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {businessAccounts.map((business) => (
                <div
                  key={business.id}
                  onClick={() => handleBusinessCardClick(business.id)}
                  className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    selectedBusiness === business.id
                      ? 'border-blue-500 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{business.name}</h3>
                        <p className="text-sm text-gray-500">{business.business_role}</p>
                      </div>
                    </div>
                    {selectedBusiness === business.id && (
                      <CheckCircle className="w-6 h-6 text-blue-500" />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">{business.adAccountsCount} Ad Accounts</span>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      business.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {business.status === 'active' ? 'Active' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Continue Button */}
            <div className="text-center">
              <button
                onClick={handleContinue}
                disabled={!selectedBusiness}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
              >
                <span>Continue to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BusinessSelectionStep;
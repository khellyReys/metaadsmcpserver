import React, { useState, useEffect } from 'react';
import { ArrowRight, Building2, Users, CheckCircle, AlertCircle, RefreshCw, Server, FileText } from 'lucide-react';
import { SupabaseClient } from '@supabase/supabase-js';

interface BusinessAccount {
  id: string;
  name: string;
  business_role: string;
  status: string;
  adAccountsCount: number;
}

interface AdAccount {
  id: string;
  name: string;
  account_status: string;
  currency: string;
  timezone_name: string;
  account_role: string;
}

interface FacebookPage {
  id: string;
  name: string;
  category: string;
  page_role: string;
  picture_url: string;
  cover_url: string;
  is_published: boolean;
  verification_status: string;
  followers_count: number;
  website: string;
  about: string;
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
  // Updated handler signature to include all required parameters
  onBusinessSelected: (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    serverAccessToken: string
  ) => void;
  onBusinessSelectionChange: (businessId: string) => void;
  onBusinessAccountsChange: (accounts: BusinessAccount[]) => void;
  onBackToServers: () => void;
  onClearError: () => void;
  supabase: SupabaseClient;
  onFetchingProgress?: (progress: number, message: string) => void;
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
  supabase,
  onFetchingProgress = () => {},
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Updated state for multi-step selection
  const [currentStep, setCurrentStep] = useState<'business' | 'adaccount' | 'page'>('business');
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAdAccount, setSelectedAdAccount] = useState<string>('');
  const [loadingAdAccounts, setLoadingAdAccounts] = useState(false);
  
  // New state for Facebook page selection
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>('');
  const [loadingPages, setLoadingPages] = useState(false);

  // Load business accounts when component mounts
  useEffect(() => {
    if (facebookAccessToken && currentUser && businessAccounts.length === 0) {
      fetchAndSaveBusinessAccounts();
    }
  }, [facebookAccessToken, currentUser]);

  const fetchAndSaveBusinessAccounts = async () => {
    if (!facebookAccessToken || !currentUser) return;
  
    try {
      
      // Report progress - Step 1
      onFetchingProgress?.(10, 'Validating Facebook token...');
      
      // Test token validity first
      const meResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${facebookAccessToken}`);
      const meData = await meResponse.json();
  
      if (meData.error) {
        throw new Error(`Facebook token invalid: ${meData.error.message}`);
      }
  
      // Report progress - Step 2
     onFetchingProgress?.(25, 'Fetching business accounts...');
  
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
  
      // Report progress - Step 3
      onFetchingProgress?.(40, 'Processing business data...');
  
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
  
      // Report progress - Step 4
      onFetchingProgress?.(60, 'Fetching additional ad accounts...');
  
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
  
      // Report progress - Step 5
      onFetchingProgress?.(80, 'Fetching Facebook pages...');
  
      // Fetch and save Facebook Pages
      await fetchAndSavePages();
  
      // Report progress - Complete
      onFetchingProgress?.(100, 'Complete!');
  
      onBusinessAccountsChange(businesses);
  
      // Clear progress after a short delay
      setTimeout(() => {
        onFetchingProgress?.(0, '');
      }, 1000);
  
    } catch (error) {
      onFetchingProgress?.(0, '');
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
    }
  };

  // Function to fetch ad accounts for selected business
  const fetchAdAccountsForBusiness = async (businessId: string) => {
    setLoadingAdAccounts(true);
    try {
      const { data: adAccountsData, error } = await supabase
        .from('facebook_ad_accounts')
        .select('id, name, account_status, currency, timezone_name, account_role')
        .eq('business_account_id', businessId)
        .eq('user_id', currentUser.id);

      if (error) {
        throw new Error('Failed to load ad accounts: ' + error.message);
      }

      setAdAccounts(adAccountsData || []);
    } catch (error) {
      setAdAccounts([]);
    } finally {
      setLoadingAdAccounts(false);
    }
  };

  // New function to fetch Facebook pages
  const fetchFacebookPages = async () => {
    setLoadingPages(true);
    try {
      const { data: pagesData, error } = await supabase
        .from('facebook_pages')
        .select('id, name, category, page_role, picture_url, cover_url, is_published, verification_status, followers_count, website, about')
        .eq('user_id', currentUser.id);

      if (error) {
        throw new Error('Failed to load Facebook pages: ' + error.message);
      }

      setFacebookPages(pagesData || []);
    } catch (error) {
      setFacebookPages([]);
    } finally {
      setLoadingPages(false);
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

  // Updated continue handler for three-step flow
  const handleContinue = async () => {
    if (currentStep === 'business' && selectedBusiness) {
      // Move to ad account selection
      await fetchAdAccountsForBusiness(selectedBusiness);
      setCurrentStep('adaccount');
    } else if (currentStep === 'adaccount' && selectedAdAccount) {
      // Move to page selection
      await fetchFacebookPages();
      setCurrentStep('page');
    } else if (currentStep === 'page' && selectedPage) {
      // Continue with all selections
      setIsProcessing(true);
      try {

        // If selectedPage is an object, extract just the ID
        const pageIdToSend = typeof selectedPage === 'object' && selectedPage?.id 
          ? selectedPage.id 
          : selectedPage;

        // Get server access token
        const selectedServerData = servers.find(s => s.id === selectedServer);
        if (!selectedServerData) {
          throw new Error('Server not found');
        }

        // Call with all required parameters
        await onBusinessSelected(
          selectedServer,                           // serverId
          selectedBusiness,                         // businessId
          selectedAdAccount,                        // adAccountId
          pageIdToSend,                            // pageId
          selectedServerData.access_token          // serverAccessToken
        );
      } catch (error) {
        // Error handled by parent component
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Updated back button handlers
  const handleBackToBusiness = () => {
    setCurrentStep('business');
    setSelectedAdAccount('');
    setAdAccounts([]);
    setSelectedPage('');
    setFacebookPages([]);
  };

  const handleBackToAdAccounts = () => {
    setCurrentStep('adaccount');
    setSelectedPage('');
    setFacebookPages([]);
  };

  // Helper function to get step title and description
  const getStepInfo = () => {
    switch (currentStep) {
      case 'business':
        return {
          title: 'Select Business Manager Account',
          description: 'Choose the business account you want to manage ads for'
        };
      case 'adaccount':
        return {
          title: 'Select Ad Account',
          description: 'Choose the ad account you want to manage'
        };
      case 'page':
        return {
          title: 'Select Facebook Page',
          description: 'Choose the Facebook page you want to connect'
        };
      default:
        return { title: '', description: '' };
    }
  };

  const stepInfo = getStepInfo();

  const getContinueButtonState = () => {
    if (currentStep === 'business') {
      return {
        isLoading: loadingAdAccounts,
        label: loadingAdAccounts ? 'Loading ad accounts...' : 'Continue to Ad Accounts',
      };
    }
    if (currentStep === 'adaccount') {
      return {
        isLoading: loadingPages,
        label: loadingPages ? 'Loading Facebook pages...' : 'Continue to Pages',
      };
    }
    // currentStep === 'page'
    return {
      isLoading: isProcessing,
      label: isProcessing ? 'Configuring account...' : 'Continue to Tools',
    };
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

          {/* Step Progress Indicator */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className={`flex items-center space-x-2 ${currentStep === 'business' ? 'text-blue-600' : currentStep === 'adaccount' || currentStep === 'page' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'business' ? 'bg-blue-100' : currentStep === 'adaccount' || currentStep === 'page' ? 'bg-green-100' : 'bg-gray-100'}`}>
                1
              </div>
              <span className="text-sm font-medium">Business</span>
            </div>
            
            <ArrowRight className={`w-4 h-4 ${currentStep === 'adaccount' || currentStep === 'page' ? 'text-green-600' : 'text-gray-400'}`} />
            
            <div className={`flex items-center space-x-2 ${currentStep === 'adaccount' ? 'text-blue-600' : currentStep === 'page' ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'adaccount' ? 'bg-blue-100' : currentStep === 'page' ? 'bg-green-100' : 'bg-gray-100'}`}>
                2
              </div>
              <span className="text-sm font-medium">Ad Account</span>
            </div>
            
            <ArrowRight className={`w-4 h-4 ${currentStep === 'page' ? 'text-green-600' : 'text-gray-400'}`} />
            
            <div className={`flex items-center space-x-2 ${currentStep === 'page' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${currentStep === 'page' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                3
              </div>
              <span className="text-sm font-medium">Page</span>
            </div>
          </div>

          {/* Dynamic header */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{stepInfo.title}</h1>
          <p className="text-gray-600">{stepInfo.description}</p>

          {/* Selection Context Info */}
          {currentStep !== 'business' && (
            <div className="bg-blue-50 rounded-lg p-3 mt-4 max-w-md mx-auto">
              {selectedBusiness && (
                <p className="text-blue-900 text-sm">
                  <strong>Business:</strong> {businessAccounts.find(b => b.id === selectedBusiness)?.name}
                </p>
              )}
              {currentStep === 'page' && selectedAdAccount && (
                <p className="text-blue-900 text-sm">
                  <strong>Ad Account:</strong> {adAccounts.find(a => a.id === selectedAdAccount)?.name}
                </p>
              )}
            </div>
          )}
          
          {/* Navigation buttons */}
          <div className="flex items-center justify-center space-x-4 mt-4">
            {currentStep === 'business' ? (
              <>
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
              </>
            ) : currentStep === 'adaccount' ? (
              <button
                onClick={handleBackToBusiness}
                className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-700 text-sm"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                <span>Back to Business Selection</span>
              </button>
            ) : (
              <button
                onClick={handleBackToAdAccounts}
                className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-700 text-sm"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                <span>Back to Ad Account Selection</span>
              </button>
            )}
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

        {/* Content based on current step */}
        {businessAccounts.length === 0 && currentStep === 'business' ? (
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
            {/* Business Cards Grid - Only show on business step */}
            {currentStep === 'business' && (
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
            )}

            {/* Ad Account Selection - Show when step is 'adaccount' */}
            {currentStep === 'adaccount' && (
              <>
                {loadingAdAccounts ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading ad accounts...</p>
                  </div>
                ) : adAccounts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Ad Accounts Found</h3>
                    <p className="text-gray-600 mb-4">
                      This business doesn't have any ad accounts associated with it.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {adAccounts.map((adAccount) => (
                      <div
                        key={adAccount.id}
                        onClick={() => setSelectedAdAccount(adAccount.id)}
                        className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                          selectedAdAccount === adAccount.id
                            ? 'border-blue-500 shadow-lg'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg flex items-center justify-center">
                              <Users className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{adAccount.name}</h3>
                              <p className="text-sm text-gray-500">Account ID: {adAccount.id}</p>
                            </div>
                          </div>
                          {selectedAdAccount === adAccount.id && (
                            <CheckCircle className="w-6 h-6 text-blue-500" />
                          )}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <span className="text-gray-600">{adAccount.currency}</span>
                            <span className="text-gray-600">{adAccount.account_role}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            adAccount.account_status === 'ACTIVE'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {adAccount.account_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Facebook Page Selection - Show when step is 'page' */}
            {currentStep === 'page' && (
              <>
                {loadingPages ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading Facebook pages...</p>
                  </div>
                ) : facebookPages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Facebook Pages Found</h3>
                    <p className="text-gray-600 mb-4">
                      You don't have access to any Facebook pages.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {facebookPages.map((page) => (
                      <div
                        key={page.id}
                        onClick={() => setSelectedPage(page.id)}
                        className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                          selectedPage === page.id
                            ? 'border-blue-500 shadow-lg'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            {page.picture_url ? (
                              <img 
                                src={page.picture_url} 
                                alt={page.name}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                                <FileText className="w-6 h-6 text-purple-600" />
                              </div>
                            )}
                            <div>
                              <h3 className="font-semibold text-gray-900">{page.name}</h3>
                              <p className="text-sm text-gray-500">{page.category}</p>
                              {page.verification_status && (
                                <p className="text-xs text-blue-600">{page.verification_status}</p>
                              )}
                            </div>
                          </div>
                          {selectedPage === page.id && (
                            <CheckCircle className="w-6 h-6 text-blue-500" />
                          )}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <Users className="w-4 h-4 text-gray-400" />
                              <span className="text-gray-600">
                                {page.followers_count ? `${page.followers_count.toLocaleString()} followers` : 'No followers data'}
                              </span>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            page.is_published
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {page.is_published ? 'Published' : 'Unpublished'}
                          </span>
                        </div>

                        {/* Additional page info */}
                        {(page.website || page.about) && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            {page.website && (
                              <p className="text-xs text-gray-600 mb-1">
                                <strong>Website:</strong> {page.website}
                              </p>
                            )}
                            {page.about && (
                              <p className="text-xs text-gray-600 line-clamp-2">
                                <strong>About:</strong> {page.about}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Continue Button - Updated to handle all three steps */}
            {((currentStep === 'business' && selectedBusiness) || 
              (currentStep === 'adaccount' && selectedAdAccount) ||
              (currentStep === 'page' && selectedPage)) && (
              <div className="text-center">
                {(() => {
                  const { isLoading, label } = getContinueButtonState();
                  return (
                    <button
                      onClick={handleContinue}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>{label}</span>
                        </>
                      ) : (
                        <>
                          <span>{label}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BusinessSelectionStep;
import React, { useState, useEffect } from 'react';
import { Facebook, ArrowRight, Building2, Users, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface BusinessAccount {
  id: string;
  name: string;
  business_role: string;
  status: string;
  adAccountsCount: number;
}

interface FacebookUser {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

interface FacebookLoginProps {
  onBusinessSelected: (businessId: string, userData: any) => void;
}

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

const FacebookLogin: React.FC<FacebookLoginProps> = ({ onBusinessSelected }) => {
  const [step, setStep] = useState<'login' | 'business-selection'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [businessAccounts, setBusinessAccounts] = useState<BusinessAccount[]>([]);
  const [error, setError] = useState<string>('');
  const [fbUser, setFbUser] = useState<FacebookUser | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Check if user is already logged in to Supabase
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        // Check if user has Facebook data and it's still valid
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userData?.facebook_id && userData.facebook_is_active) {
          // Check if token is still valid (not expired)
          const tokenExpiry = new Date(userData.facebook_token_expires_at);
          if (tokenExpiry > new Date()) {
            // User has valid Facebook connection, load their business accounts
            setFbUser({
              id: userData.facebook_id,
              name: userData.facebook_name,
              email: userData.facebook_email,
              picture: userData.facebook_picture_url ? {
                data: { url: userData.facebook_picture_url }
              } : undefined
            });
            setAccessToken(userData.facebook_long_lived_token);
            await loadBusinessAccountsFromDB(user.id);
            setStep('business-selection');
            return;
          }
        }
      }
    };

    checkUser();

    // Load Facebook SDK
    const loadFacebookSDK = () => {
      return new Promise<void>((resolve) => {
        if (window.FB) {
          resolve();
          return;
        }

        window.fbAsyncInit = function() {
          window.FB.init({
            appId: import.meta.env.VITE_FACEBOOK_APP_ID,
            cookie: true,
            xfbml: true,
            version: 'v18.0'
          });
          resolve();
        };

        // Load the SDK
        const script = document.createElement('script');
        script.id = 'facebook-jssdk';
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        document.body.appendChild(script);
      });
    };

    loadFacebookSDK();
  }, []);

  const loadBusinessAccountsFromDB = async (userId: string) => {
    try {
      const { data: businesses, error } = await supabase
        .from('facebook_business_accounts')
        .select(`
          id,
          name,
          business_role,
          status,
          facebook_ad_accounts(count)
        `)
        .eq('user_id', userId);

      if (error) throw error;

      const formattedBusinesses: BusinessAccount[] = businesses?.map(business => ({
        id: business.id,
        name: business.name,
        business_role: business.business_role || 'User',
        status: business.status || 'active',
        adAccountsCount: business.facebook_ad_accounts?.[0]?.count || 0
      })) || [];

      setBusinessAccounts(formattedBusinesses);
    } catch (err) {
      console.error('Error loading business accounts:', err);
      setError('Failed to load business accounts from database.');
    }
  };

  const handleFacebookLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      await new Promise<void>((resolve) => {
        window.FB.login(async (response: any) => {
          if (response.authResponse) {
            const { accessToken: fbAccessToken } = response.authResponse;
            setAccessToken(fbAccessToken);
            
            // Get user info
            window.FB.api('/me', { fields: 'id,name,email,picture' }, async (userResponse: FacebookUser) => {
              setFbUser(userResponse);
              
              try {
                // Create Supabase user if not exists
                let supabaseUser = currentUser;
                if (!supabaseUser) {
                  const { data, error } = await supabase.auth.signUp({
                    email: userResponse.email || `${userResponse.id}@facebook.local`,
                    password: `fb_${userResponse.id}_${Date.now()}`, // Random password
                    options: {
                      data: {
                        full_name: userResponse.name,
                        facebook_id: userResponse.id
                      }
                    }
                  });
                  if (error) throw error;
                  supabaseUser = data.user;
                  setCurrentUser(supabaseUser);
                }

                // Exchange for long-lived token and save to database
                await exchangeTokenAndSaveUser(fbAccessToken, userResponse, supabaseUser);
                
                // Get business accounts from Facebook and save to DB
                await fetchAndSaveBusinessAccounts(fbAccessToken, supabaseUser.id);
                
                setStep('business-selection');
                resolve();
              } catch (err) {
                console.error('Error processing Facebook login:', err);
                setError('Failed to process Facebook login. Please try again.');
                resolve();
              }
            });
          } else {
            setError('Facebook login was cancelled or failed.');
            resolve();
          }
        }, {
          scope: 'email,pages_read_engagement,pages_manage_posts,pages_show_list,business_management,ads_management,ads_read'
        });
      });
    } catch (err) {
      setError('An error occurred during Facebook login.');
      console.error('Facebook login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const exchangeTokenAndSaveUser = async (shortToken: string, user: FacebookUser, supabaseUser: any) => {
    try {
      // Exchange for long-lived token
      const longLivedResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${import.meta.env.VITE_FACEBOOK_APP_ID}&` +
        `client_secret=${import.meta.env.VITE_FACEBOOK_APP_SECRET}&` +
        `fb_exchange_token=${shortToken}`
      );

      const longLivedData = await longLivedResponse.json();

      if (!longLivedData.access_token) {
        throw new Error('Failed to get long-lived token');
      }

      // Get token info
      const tokenInfoResponse = await fetch(
        `https://graph.facebook.com/v18.0/debug_token?` +
        `input_token=${longLivedData.access_token}&` +
        `access_token=${import.meta.env.VITE_FACEBOOK_APP_ID}|${import.meta.env.VITE_FACEBOOK_APP_SECRET}`
      );

      const tokenInfo = await tokenInfoResponse.json();
      const expiresAt = tokenInfo.data?.expires_at 
        ? new Date(tokenInfo.data.expires_at * 1000) 
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days default

      // Get user's granted permissions
      const permissionsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/permissions?access_token=${longLivedData.access_token}`
      );
      const permissionsData = await permissionsResponse.json();
      const grantedScopes = permissionsData.data
        ?.filter((perm: any) => perm.status === 'granted')
        ?.map((perm: any) => perm.permission) || [];

      // Save user data with Facebook info using the database function
      const { data: userAccessToken, error: dbError } = await supabase
        .rpc('upsert_user_with_facebook_data', {
          p_user_id: supabaseUser.id,
          p_email: user.email || supabaseUser.email,
          p_name: user.name || supabaseUser.user_metadata?.full_name,
          p_facebook_id: user.id,
          p_facebook_name: user.name,
          p_facebook_email: user.email,
          p_facebook_picture_url: user.picture?.data?.url,
          p_facebook_access_token: shortToken,
          p_facebook_long_lived_token: longLivedData.access_token,
          p_facebook_token_expires_at: expiresAt.toISOString(),
          p_facebook_scopes: grantedScopes
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to save user data');
      }

      // Update access token for future API calls
      setAccessToken(longLivedData.access_token);

      console.log('User access token for MCP:', userAccessToken);

    } catch (error) {
      console.error('Error exchanging token:', error);
      throw error;
    }
  };

  const fetchAndSaveBusinessAccounts = async (token: string, userId: string) => {
    try {
      // Get businesses from Facebook
      const businessResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?` +
        `access_token=${token}&` +
        `fields=id,name,primary_page,owned_ad_accounts{account_id,name,account_status,currency,timezone_name}`
      );

      const businessData = await businessResponse.json();

      const businesses: BusinessAccount[] = [];

      if (businessData.data && businessData.data.length > 0) {
        for (const business of businessData.data) {
          // Save business account to database
          const { error: businessError } = await supabase
            .from('facebook_business_accounts')
            .upsert({
              id: business.id,
              user_id: userId,
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
                  user_id: userId,
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

      // Also get ad accounts user has access to (not necessarily owned)
      const adAccountsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?` +
        `access_token=${token}&` +
        `fields=account_id,name,account_status,business,currency,timezone_name`
      );

      const adAccountsData = await adAccountsResponse.json();

      if (adAccountsData.data) {
        const adAccountsByBusiness: { [key: string]: any[] } = {};
        
        for (const adAccount of adAccountsData.data) {
          if (adAccount.business) {
            const businessId = adAccount.business.id;
            
            // Save ad account if not already saved
            const { error: adAccountError } = await supabase
              .from('facebook_ad_accounts')
              .upsert({
                id: adAccount.account_id,
                business_account_id: businessId,
                user_id: userId,
                name: adAccount.name,
                account_status: adAccount.account_status,
                currency: adAccount.currency,
                timezone_name: adAccount.timezone_name,
                account_role: 'USER', // Since this is from /me/adaccounts, not owned
              }, {
                onConflict: 'id'
              });

            if (!adAccountError) {
              if (!adAccountsByBusiness[businessId]) {
                adAccountsByBusiness[businessId] = [];
              }
              adAccountsByBusiness[businessId].push(adAccount);
            }
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
      await fetchAndSavePages(token, userId);

      setBusinessAccounts(businesses);

    } catch (error) {
      console.error('Error fetching business accounts:', error);
      setError('Failed to fetch business accounts from Facebook.');
    }
  };

  const fetchAndSavePages = async (token: string, userId: string) => {
    try {
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?` +
        `access_token=${token}&` +
        `fields=id,name,category,access_token,picture,cover,is_published,verification_status,fan_count,website,about`
      );

      const pagesData = await pagesResponse.json();

      if (pagesData.data) {
        for (const page of pagesData.data) {
          await supabase
            .from('facebook_pages')
            .upsert({
              id: page.id,
              user_id: userId,
              name: page.name,
              category: page.category,
              access_token: page.access_token,
              page_role: 'ADMIN', // User has access_token, so they're admin
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
    if (!accessToken || !currentUser) return;
    
    setIsRefreshing(true);
    try {
      await fetchAndSaveBusinessAccounts(accessToken, currentUser.id);
    } catch (error) {
      setError('Failed to refresh data.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBusinessSelection = async () => {
    if (selectedBusiness && currentUser) {
      // Get the selected business data
      const selectedBusinessData = businessAccounts.find(b => b.id === selectedBusiness);
      
      // Get user data from database
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      onBusinessSelected(selectedBusiness, {
        user: userData,
        business: selectedBusinessData,
        accessToken
      });
    }
  };

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Facebook className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Facebook Account</h1>
              <p className="text-gray-600">
                Sign in with Facebook to access your Business Manager accounts and start automating your ads.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleFacebookLogin}
              disabled={isLoading}
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Facebook className="w-5 h-5" />
                  <span>Continue with Facebook</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                By continuing, you agree to our{' '}
                <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
              </p>
            </div>

            <div className="mt-6 bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Required Permissions:</h3>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Access to your business accounts</li>
                <li>• Read and manage your ad accounts</li>
                <li>• Access to your Facebook pages</li>
                <li>• Create and manage advertisements</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="text-center mb-8">
          {fbUser && (
            <div className="flex items-center justify-center space-x-3 mb-4">
              {fbUser.picture && (
                <img 
                  src={fbUser.picture.data.url} 
                  alt={fbUser.name}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <p className="text-lg font-semibold text-gray-900">Welcome, {fbUser.name}!</p>
                <p className="text-sm text-gray-600">{fbUser.email}</p>
              </div>
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Business Manager Account</h1>
          <p className="text-gray-600">Choose the business account you want to manage ads for</p>
          
          <button
            onClick={handleRefreshData}
            disabled={isRefreshing}
            className="mt-4 inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {businessAccounts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Business Accounts Found</h3>
            <p className="text-gray-600 mb-4">You don't have access to any Facebook Business Manager accounts.</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {businessAccounts.map((business) => (
                <div
                  key={business.id}
                  onClick={() => setSelectedBusiness(business.id)}
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

            <div className="text-center">
              <button
                onClick={handleBusinessSelection}
                disabled={!selectedBusiness}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
              >
                <span>Continue to Ad Tools</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FacebookLogin;
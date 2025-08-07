import React, { useState, useEffect } from 'react';
import { Facebook, ArrowRight, Building2, Users, CheckCircle, AlertCircle, RefreshCw, Server, Plus, X } from 'lucide-react';
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

interface Server {
  id: string;
  name: string;
  access_token: string;
  created_at: string;
  is_active: boolean;
}

interface FacebookLoginProps {
  onServerSelected: (serverId: string, businessId: string, serverData: any) => void;
  initialAuthData?: any;
}

const FacebookLogin: React.FC<FacebookLoginProps> = ({ onServerSelected, initialAuthData }) => {
  const [step, setStep] = useState<'login' | 'server-creation' | 'business-selection'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [facebookAccessToken, setFacebookAccessToken] = useState<string>('');
  const [businessAccounts, setBusinessAccounts] = useState<BusinessAccount[]>([]);
  const [error, setError] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userSession, setUserSession] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Server creation states
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverName, setServerName] = useState('');
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');

  useEffect(() => {
    if (initialAuthData) {
      console.log('Received initial auth data from callback:', initialAuthData);
      
      setCurrentUser(initialAuthData.user);
      setUserSession(initialAuthData.session);
      setFacebookAccessToken(initialAuthData.facebookToken || initialAuthData.session?.provider_token);
      
      // Skip directly to server creation step
      loadUserServers(initialAuthData.user.id).then(() => {
        setStep('server-creation');
      });
    }
  }, [initialAuthData]);

  useEffect(() => {
    let mounted = true;
  
    const checkSession = async () => {
      setIsLoading(true);
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          setError('Failed to retrieve session. Please try logging in again.');
          return;
        }
  
        if (session?.user && mounted) {
          console.log('Found existing session:', session.user.id);
          setCurrentUser(session.user);
          setUserSession(session);
          
          if (session.provider_token) {
            setFacebookAccessToken(session.provider_token);
          }
  
          await processAuthenticatedUser(session);
        }
      } catch (err) {
        console.error('Error checking session:', err);
        if (mounted) {
          setError('Failed to initialize session. Please refresh the page.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Add this debugging function at the top of your component
const debugSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('Anon Key (first 20 chars):', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20));
    
    // Test basic connection
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
    } else {
      console.log('Supabase connection test successful');
    }

    // Test auth status
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Current session status:', !!session);
    
  } catch (err) {
    console.error('Supabase debug error:', err);
  }
};

// Call this function in your useEffect or when debugging
// debugSupabaseConnection();

// Improved Facebook API calls with better error handling
const fetchAndSaveBusinessAccounts = async (token: string, userId: string) => {
  if (!token) {
    setError('No Facebook access token available. Please try logging in again.');
    return;
  }

  try {
    console.log('Fetching business accounts with token:', token.substring(0, 20) + '...');
    
    // Test token validity first
    const meResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${token}`);
    const meData = await meResponse.json();
    
    if (meData.error) {
      throw new Error(`Facebook token invalid: ${meData.error.message}`);
    }

    console.log('Facebook token is valid for user:', meData.name);

    // Continue with business accounts fetch...
    const businessResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/businesses?` +
      `access_token=${token}&` +
      `fields=id,name,primary_page,owned_ad_accounts{account_id,name,account_status,currency,timezone_name}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!businessResponse.ok) {
      throw new Error(`HTTP error! status: ${businessResponse.status}`);
    }

    const businessData = await businessResponse.json();

    if (businessData.error) {
      throw new Error(`Facebook API error: ${businessData.error.message}`);
    }

    // Rest of your existing logic...
    const businesses: BusinessAccount[] = [];
    // ... continue with your existing implementation

  } catch (error) {
    console.error('Error fetching business accounts:', error);
    setError(`Failed to fetch business accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
  
    // Listen for auth state changes with better error handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id);
      
      try {
        if (event === 'SIGNED_IN' && session?.user && mounted) {
          setCurrentUser(session.user);
          setUserSession(session);
          
          if (session.provider_token) {
            setFacebookAccessToken(session.provider_token);
          }
  
          await processAuthenticatedUser(session);
        } else if (event === 'SIGNED_OUT' && mounted) {
          setCurrentUser(null);
          setUserSession(null);
          setFacebookAccessToken('');
          setStep('login');
        } else if (event === 'TOKEN_REFRESHED' && session && mounted) {
          setUserSession(session);
          if (session.provider_token) {
            setFacebookAccessToken(session.provider_token);
          }
        }
      } catch (error) {
        console.error('Error handling auth state change:', error);
        if (mounted) {
          setError('Authentication error occurred. Please try logging in again.');
        }
      }
    });
  
    checkSession();
  
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;
  
    const initConnection = async () => {
      if (selectedServer && servers.length > 0 && step === 'business-selection') {
        // Optional: Test server health first
        const isHealthy = await testServerConnection();
        if (!isHealthy) {
          setError('Server is not responding. Please try again later.');
          return;
        }
  
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
  }, [selectedServer, servers, step]); 

  const processAuthenticatedUser = async (session: any) => {
    try {
      const user = session.user;
      
      // Extract Facebook user data from user metadata
      const facebookData = {
        id: user.user_metadata?.provider_id || user.user_metadata?.sub,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
        email: user.email,
        picture_url: user.user_metadata?.avatar_url || user.user_metadata?.picture
      };

      console.log('Processing user with Facebook data:', facebookData);

      // Save/update user data in database
      await exchangeTokenAndSaveUser(session.provider_token, facebookData, user);
      
      // Load existing servers
      await loadUserServers(user.id);
      
      setStep('server-creation');
      
    } catch (err) {
      console.error('Error processing authenticated user:', err);
      setError(`Failed to process user data: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleFacebookLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Use the frontend URL for the callback, not the MCP server URL
      const frontendUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const redirectUrl = `${frontendUrl}/auth/callback`;
      
      console.log('OAuth redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          scopes: 'email pages_read_engagement pages_manage_posts pages_show_list business_management ads_management ads_read',
          redirectTo: redirectUrl, // This should be your FRONTEND URL
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        throw error;
      }

      // OAuth redirect will happen automatically to the FRONTEND /auth/callback
      
    } catch (err) {
      console.error('Facebook OAuth error:', err);
      setError(`Facebook login failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  const exchangeTokenAndSaveUser = async (providerToken: string, facebookData: any, supabaseUser: any) => {
    try {
      if (!providerToken) {
        console.warn('No provider token available, using basic data');
        await saveUserToDatabase(null, facebookData, supabaseUser);
        return;
      }
  
      console.log('Calling edge function to exchange token...');
      
      // Get the session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exchange-facebook-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          shortLivedToken: providerToken,
          userId: supabaseUser.id
          // Remove the redirectUri line - it's not needed for token exchange
        })
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
  
      if (data.success) {
        console.log('Token exchange successful:', {
          expiresAt: data.expiresAt,
          scopes: data.grantedScopes,
          facebookUserId: data.facebookUserId
        });
  
        setFacebookAccessToken(data.longLivedToken);
        await saveUserToDatabase(data, facebookData, supabaseUser);
      } else {
        console.warn('Token exchange failed, using provider token:', data.error);
        await saveUserToDatabase(null, facebookData, supabaseUser, providerToken);
      }
  
    } catch (error) {
      console.error('Token exchange failed:', error);
      // Save with provider token as fallback
      await saveUserToDatabase(null, facebookData, supabaseUser, providerToken);
    }
  };

  const saveUserToDatabase = async (tokenData: any, facebookData: any, supabaseUser: any, fallbackToken?: string) => {
    try {
      const tokenToUse = tokenData?.longLivedToken || fallbackToken || facebookAccessToken;
      const expiresAt = tokenData?.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours fallback
      const scopes = tokenData?.grantedScopes || ['email', 'pages_read_engagement', 'business_management', 'ads_management'];

      const { data: userAccessToken, error: dbError } = await supabase
        .rpc('upsert_user_with_facebook_data', {
          p_user_id: supabaseUser.id,
          p_email: supabaseUser.email,
          p_name: facebookData.name,
          p_facebook_id: facebookData.id,
          p_facebook_name: facebookData.name,
          p_facebook_email: supabaseUser.email,
          p_facebook_picture_url: facebookData.picture_url,
          p_facebook_access_token: fallbackToken || facebookAccessToken,
          p_facebook_long_lived_token: tokenToUse,
          p_facebook_token_expires_at: expiresAt,
          p_facebook_scopes: scopes
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to save user data: ' + dbError.message);
      }

      console.log('User data saved successfully, MCP access token:', userAccessToken);

    } catch (error) {
      console.error('Error saving user to database:', error);
      throw error;
    }
  };

  const loadUserServers = async (userId: string) => {
    try {
      const { data: serversData, error } = await supabase
        .rpc('get_user_servers', {
          p_user_id: userId
        });

      if (error) throw error;

      const serversList: Server[] = (serversData || []).map((server: any) => ({
        id: server.server_id,
        name: server.server_name,
        access_token: server.session_token,
        created_at: server.created_at,
        is_active: server.is_active
      }));

      setServers(serversList);
    } catch (err) {
      console.error('Error loading servers:', err);
    }
  };

  const handleCreateServer = async () => {
    if (!serverName.trim() || !currentUser) return;

    setIsCreatingServer(true);
    setError('');

    try {
      // Create new server with MCP session
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

      setServers(prev => [newServer, ...prev]);
      setServerName('');
      setShowServerModal(false);

      console.log('Server created successfully:', {
        serverId: newServerData.server_id,
        sessionToken: newServerData.session_token,
        accessToken: newServerData.access_token
      });

    } catch (err) {
      console.error('Error creating server:', err);
      setError(`Failed to create server: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsCreatingServer(false);
    }
  };

  const handleSelectServer = async (serverId: string) => {
    setSelectedServer(serverId);
    
    if (!currentUser) return;

    // Load business accounts for this server
    await fetchAndSaveBusinessAccounts(facebookAccessToken, currentUser.id);
    setStep('business-selection');
  };

  const fetchAndSaveBusinessAccounts = async (token: string, userId: string) => {
    if (!token) {
      setError('No Facebook access token available. Please try logging in again.');
      return;
    }

    try {
      // Get businesses from Facebook
      const businessResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?` +
        `access_token=${token}&` +
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
              } else {
                console.error('Error saving ad account:', adAccountError);
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

      if (adAccountsData.error) {
        console.error('Facebook API error for ad accounts:', adAccountsData.error);
      } else if (adAccountsData.data) {
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
                account_role: 'USER',
              }, {
                onConflict: 'id'
              });

            if (!adAccountError) {
              if (!adAccountsByBusiness[businessId]) {
                adAccountsByBusiness[businessId] = [];
              }
              adAccountsByBusiness[businessId].push(adAccount);
            } else {
              console.error('Error saving ad account (user access):', adAccountError);
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
      setError(`Failed to fetch business accounts: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      if (pagesData.error) {
        console.error('Facebook API error for pages:', pagesData.error);
        return;
      }

      if (pagesData.data) {
        for (const page of pagesData.data) {
          const { error } = await supabase
            .from('facebook_pages')
            .upsert({
              id: page.id,
              user_id: userId,
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

          if (error) {
            console.error('Error saving page:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching pages:', error);
    }
  };

  const handleRefreshData = async () => {
    if (!facebookAccessToken || !currentUser) return;
    
    setIsRefreshing(true);
    try {
      await fetchAndSaveBusinessAccounts(facebookAccessToken, currentUser.id);
    } catch (error) {
      setError('Failed to refresh data.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBusinessSelection = async () => {
    if (selectedBusiness && currentUser && selectedServer) {
      try {
        // Update server's selected business
        const { data: updateResult, error: updateError } = await supabase
          .rpc('update_server_business', {
            p_server_id: selectedServer,
            p_business_id: selectedBusiness
          });

        if (updateError) {
          throw new Error('Failed to update server business: ' + updateError.message);
        }

        // Get the selected business data
        const selectedBusinessData = businessAccounts.find(b => b.id === selectedBusiness);
        const selectedServerData = servers.find(s => s.id === selectedServer);
        
        // Get user data from database
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        onServerSelected(selectedServer, selectedBusiness, {
          user: userData,
          business: selectedBusinessData,
          server: selectedServerData,
          accessToken: facebookAccessToken,
          session: userSession
        });
      } catch (err) {
        console.error('Error selecting business:', err);
        setError(`Failed to select business: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // SSE Connection function
// Replace your connectToSSE function with this improved version:

const connectToSSE = (accessToken: string) => {
  if (!accessToken) {
    setError('No server token available for SSE connection');
    return null;
  }

  // Create the token in the format your server expects
  const serverId = selectedServer;
  const tokenString = `${serverId}:${accessToken}`;
  const encodedToken = btoa(tokenString);
  
  // Use the MCP server URL for SSE connections
  const mcpServerUrl = import.meta.env.VITE_MCP_SERVER_URL || 'https://metaadsmcpserver.onrender.com';
  const sseUrl = `${mcpServerUrl}/sse?token=${encodeURIComponent(encodedToken)}`;
  console.log('SSE Connection Details:');
  console.log('- Server ID:', serverId);
  console.log('- Access Token (first 20 chars):', accessToken.substring(0, 20) + '...');
  console.log('- Token String:', tokenString);
  console.log('- Encoded Token:', encodedToken);
  console.log('- Full URL:', sseUrl);

  try {
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = (event) => {
      console.log('✅ SSE connection opened successfully');
      console.log('Event details:', event);
      setError(''); // Clear any previous errors
    };

    eventSource.onmessage = (event) => {
      console.log('📨 SSE message received:', {
        data: event.data,
        lastEventId: event.lastEventId,
        origin: event.origin,
        type: event.type
      });
      
      try {
        if (event.data.startsWith('{')) {
          const data = JSON.parse(event.data);
          console.log('📋 SSE parsed JSON:', data);
          
          // Handle MCP protocol messages
          if (data.method === 'notifications/initialized') {
            console.log('🎉 MCP server initialized');
          } else if (data.method === 'tools/list') {
            console.log('🔧 Available tools:', data.result?.tools || []);
          } else if (data.jsonrpc) {
            console.log('📡 JSON-RPC message:', data);
          }
        } else {
          console.log('📝 Plain text SSE message:', event.data);
        }
      } catch (parseError) {
        console.error('❌ Error parsing SSE message:', parseError);
        console.log('Raw data that failed to parse:', event.data);
      }
    };

    eventSource.onerror = (event) => {
      console.error('💥 SSE connection error:', event);
      console.log('EventSource readyState:', eventSource.readyState);
      console.log('EventSource URL:', eventSource.url);
      
      switch (eventSource.readyState) {
        case EventSource.CONNECTING:
          console.log('🔄 SSE attempting to reconnect...');
          setError('Connecting to server...');
          break;
        case EventSource.CLOSED:
          console.log('🚫 SSE connection was closed');
          setError('Connection to server was lost. Please try reconnecting.');
          break;
        case EventSource.OPEN:
          console.log('✅ SSE connection is open but got error event');
          break;
        default:
          console.log('❓ Unknown SSE state:', eventSource.readyState);
          setError('Unknown connection state. Please try again.');
      }
    };

    return eventSource;

  } catch (error) {
    console.error('💥 Failed to create SSE connection:', error);
    setError(`Failed to connect to server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

// Test the server health first (optional)

const testServerConnection = async () => {
  try {
    console.log('Testing server connection...');
    
    // Use the MCP server URL for health checks
    const mcpServerUrl = import.meta.env.VITE_MCP_SERVER_URL || 'https://metaadsmcpserver.onrender.com';
    const testUrl = `${mcpServerUrl}/test`;
    
    // Try the test endpoint first
    const testResponse = await fetch(testUrl, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log('Server test successful:', testData);
      return true;
    } else {
      console.error('Server test failed with status:', testResponse.status);
      return false;
    }
  } catch (error) {
    console.error('Server connection test failed:', error);
    
    // If fetch fails completely, the server might be down or CORS is blocking everything
    if (error.message.includes('CORS')) {
      console.log('CORS issue detected - server may not have updated CORS settings');
    } else if (error.message.includes('Failed to fetch')) {
      console.log('Server appears to be down or unreachable');
    }
    
    return false;
  }
};


  // Login Step
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
                  <span>Redirecting to Facebook...</span>
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
              <h3 className="text-sm font-medium text-blue-900 mb-2">What happens next:</h3>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• You'll be redirected to Facebook to authorize</li>
                <li>• We'll securely exchange your tokens</li>
                <li>• You'll be brought back to create your MCP server</li>
                <li>• Then select your business account</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }


  // Server Creation Step
  if (step === 'server-creation') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
        <div className="max-w-4xl mx-auto pt-8">
          <div className="text-center mb-8">
            {currentUser && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {currentUser.user_metadata?.avatar_url && (
                    <img 
                      src={currentUser.user_metadata.avatar_url} 
                      alt={currentUser.user_metadata?.full_name}
                      className="w-12 h-12 rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-lg font-semibold text-gray-900">Welcome, {currentUser.user_metadata?.full_name || currentUser.email}!</p>
                    <p className="text-sm text-gray-600">{currentUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign Out
                </button>
              </div>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Your MCP Servers</h1>
            <p className="text-gray-600">Create and manage your Facebook ads automation servers</p>
          </div>

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
              <h2 className="text-xl font-semibold text-gray-900">Your Servers ({servers.length})</h2>
              <button
                onClick={() => setShowServerModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
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
                <p className="text-gray-600 mb-4">Create your first MCP server to start automating Facebook ads.</p>
                <button
                  onClick={() => setShowServerModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Server</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {servers.map((server) => (
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
                          <p className="text-sm text-gray-500">Created {new Date(server.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-600 font-medium mb-1">Access Token:</p>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono break-all">
                        {server.access_token.substring(0, 20)}...
                      </code>
                    </div>

                    <button
                      onClick={() => handleSelectServer(server.id)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                    >
                      <span>Select Server</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
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
  }

  // Business Selection Step
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto pt-8">
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
                <p className="text-lg font-semibold text-gray-900">Welcome, {currentUser.user_metadata?.full_name || currentUser.email}!</p>
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
              onClick={() => setStep('server-creation')}
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-700 text-sm"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              <span>Back to Servers</span>
            </button>
          </div>
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

export default FacebookLogin;
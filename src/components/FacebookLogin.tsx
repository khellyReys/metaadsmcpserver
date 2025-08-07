import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import LoginStep from './LoginStep';
import ServerManagementStep from './ServerManagementStep';
import BusinessSelectionStep from './BusinessSelectionStep';

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

type Step = 'login' | 'server-creation' | 'business-selection';

const FacebookLogin: React.FC<FacebookLoginProps> = ({ 
  onServerSelected, 
  initialAuthData 
}) => {
  // Main state
  const [step, setStep] = useState<Step>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userSession, setUserSession] = useState<any>(null);
  const [facebookAccessToken, setFacebookAccessToken] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Data state
  const [servers, setServers] = useState<Server[]>([]);
  const [businessAccounts, setBusinessAccounts] = useState<BusinessAccount[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');

  // Initialize auth state and handle initial auth data
  useEffect(() => {
    if (initialAuthData) {
      console.log('Received initial auth data from callback:', initialAuthData);
      
      setCurrentUser(initialAuthData.user);
      setUserSession(initialAuthData.session);
      setFacebookAccessToken(initialAuthData.facebookToken || initialAuthData.session?.provider_token);
      
      loadUserServers(initialAuthData.user.id).then(() => {
        setStep('server-creation');
      });
    }
  }, [initialAuthData]);

  // Session management
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

    // Listen for auth state changes
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

  // Helper functions
  const processAuthenticatedUser = async (session: any) => {
    try {
      const user = session.user;
      
      const facebookData = {
        id: user.user_metadata?.provider_id || user.user_metadata?.sub,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
        email: user.email,
        picture_url: user.user_metadata?.avatar_url || user.user_metadata?.picture
      };

      console.log('Processing user with Facebook data:', facebookData);

      await exchangeTokenAndSaveUser(session.provider_token, facebookData, user);
      await loadUserServers(user.id);
      
      setStep('server-creation');
      
    } catch (err) {
      console.error('Error processing authenticated user:', err);
      setError(`Failed to process user data: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
      await saveUserToDatabase(null, facebookData, supabaseUser, providerToken);
    }
  };

  const saveUserToDatabase = async (tokenData: any, facebookData: any, supabaseUser: any, fallbackToken?: string) => {
    try {
      const tokenToUse = tokenData?.longLivedToken || fallbackToken || facebookAccessToken;
      const expiresAt = tokenData?.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Step handlers
  const handleLoginSuccess = () => {
    // Auth state change will handle the transition
  };

  const handleServerSelected = (serverId: string) => {
    setSelectedServer(serverId);
    setStep('business-selection');
  };

  const handleServerCreated = (newServer: Server) => {
    setServers(prev => [newServer, ...prev]);
  };

  const handleBusinessSelected = async (businessId: string) => {
    if (!currentUser || !selectedServer) return;

    try {
      const { data: updateResult, error: updateError } = await supabase
        .rpc('update_server_business', {
          p_server_id: selectedServer,
          p_business_id: businessId
        });

      if (updateError) {
        throw new Error('Failed to update server business: ' + updateError.message);
      }

      const selectedBusinessData = businessAccounts.find(b => b.id === businessId);
      const selectedServerData = servers.find(s => s.id === selectedServer);
      
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      onServerSelected(selectedServer, businessId, {
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
  };

  const handleBackToServers = () => {
    setSelectedBusiness('');
    setStep('server-creation');
  };

  // Clear error helper
  const clearError = () => setError('');

  // Render appropriate step
  switch (step) {
    case 'login':
      return (
        <LoginStep
          isLoading={isLoading}
          error={error}
          onLogin={handleLoginSuccess}
          onClearError={clearError}
          supabase={supabase}
        />
      );

    case 'server-creation':
      return (
        <ServerManagementStep
          currentUser={currentUser}
          servers={servers}
          error={error}
          onServerSelected={handleServerSelected}
          onServerCreated={handleServerCreated}
          onLogout={handleLogout}
          onClearError={clearError}
          supabase={supabase}
        />
      );

    case 'business-selection':
      return (
        <BusinessSelectionStep
          currentUser={currentUser}
          selectedServer={selectedServer}
          servers={servers}
          businessAccounts={businessAccounts}
          selectedBusiness={selectedBusiness}
          facebookAccessToken={facebookAccessToken}
          error={error}
          onBusinessSelected={handleBusinessSelected}
          onBusinessSelectionChange={setSelectedBusiness}
          onBusinessAccountsChange={setBusinessAccounts}
          onBackToServers={handleBackToServers}
          onClearError={clearError}
          supabase={supabase}
        />
      );

    default:
      return null;
  }
};

export default FacebookLogin;
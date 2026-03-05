import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth/authService';
import { getEnvVar } from '../lib/env';
import { fetchWithTimeout, promiseWithTimeout } from '../lib/asyncUtils';
import { useVisibilityReset } from '../hooks/useVisibilityReset';
import LoginStep from './LoginStep';
import ServerManagementStep from './ServerManagementStep';
import BusinessSelectionStep from './BusinessSelectionStep';
import Spinner from './Spinner';
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
  onServerSelected: (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    serverAccessToken: string,
    userId?: string
  ) => void;
  initialAuthData?: { user: { id: string }; session?: { provider_token?: string; access_token?: string }; facebookToken?: string };
  backToState?: { backToStep?: string; serverId?: string; businessId?: string; adAccountId?: string };
  pathname?: string;
}

type Step = 'login' | 'server-creation' | 'business-selection';

const FacebookLogin: React.FC<FacebookLoginProps> = ({ 
  onServerSelected, 
  initialAuthData,
  backToState,
  pathname: pathnameProp = '',
}) => {
  const navigate = useNavigate();
  const pathname = pathnameProp || '';

  // Derive step from URL for dashboard routes
  const stepFromUrl: Step | null =
    pathname === '/dashboard' || pathname === '/dashboard/' || pathname.startsWith('/dashboard/login')
      ? 'login'
      : pathname.startsWith('/dashboard/server')
        ? 'server-creation'
        : pathname.startsWith('/dashboard/business') || pathname.startsWith('/dashboard/adaccount') || pathname.startsWith('/dashboard/page')
          ? 'business-selection'
          : null;

  const step = stepFromUrl ?? 'login';

  // Main state (step is now URL-driven when on dashboard routes)
  const [currentUser, setCurrentUser] = useState<{ id: string; user_metadata?: Record<string, unknown>; email?: string } | null>(null);
  const [userSession, setUserSession] = useState<{ provider_token?: string } | null>(null);
  const [facebookAccessToken, setFacebookAccessToken] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [facebookTokenStatus, setFacebookTokenStatus] = useState<'unknown' | 'valid' | 'expired'>('unknown');

  // Data state
  const [servers, setServers] = useState<Server[]>([]);
  const [businessAccounts, setBusinessAccounts] = useState<BusinessAccount[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');

  const restoreToPageAttempted = useRef(false);

  useVisibilityReset(() => setIsLoading(false));

  const FACEBOOK_TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

  const checkFacebookTokenStatus = async (): Promise<'valid' | 'expired'> => {
    const { data, error: rpcError } = await supabase.rpc('get_my_facebook_token_status');
    if (rpcError || !data) return 'expired';
    const hasToken = data?.has_token === true;
    const expiresAt = data?.expires_at;
    if (!hasToken || !expiresAt) return 'expired';
    const expirationTime = new Date(expiresAt).getTime();
    const now = Date.now();
    if (expirationTime - FACEBOOK_TOKEN_BUFFER_MS <= now) return 'expired';
    return 'valid';
  };

  /** Prefer long-lived token from DB so the frontend doesn't use short-lived session.provider_token. */
  const loadLongLivedTokenFromDb = async (userId: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('users')
      .select('facebook_long_lived_token, facebook_access_token')
      .eq('id', userId)
      .maybeSingle();
    if (error) return null;
    return data?.facebook_long_lived_token || data?.facebook_access_token || null;
  };

  // Restore to Page selection step when returning from Tools ("Back to page")
  useEffect(() => {
    if (
      backToState?.backToStep !== 'page' ||
      !backToState?.serverId ||
      !backToState?.businessId ||
      !backToState?.adAccountId ||
      !currentUser ||
      !facebookAccessToken ||
      restoreToPageAttempted.current
    ) return;

    restoreToPageAttempted.current = true;
    const fetchAndRestoreToPage = async () => {
      try {
        await promiseWithTimeout(
          (async () => {
            const businessResponse = await fetchWithTimeout(
              `https://graph.facebook.com/v18.0/me/businesses?` +
                `access_token=${facebookAccessToken}&` +
                `fields=id,name,primary_page,owned_ad_accounts{account_id,name,account_status,currency,timezone_name}`,
              { timeoutMs: 20000 }
            );
            const businessData = await businessResponse.json();
            if (businessData.error || !businessData.data?.length) {
              restoreToPageAttempted.current = false;
              return;
            }

            const businesses: BusinessAccount[] = [];
            for (const business of businessData.data) {
              await supabase.from('facebook_business_accounts').upsert({
                id: business.id,
                user_id: currentUser.id,
                name: business.name,
                business_role: 'Admin',
                status: 'active',
                primary_page_id: business.primary_page?.id,
              });
              let adAccountCount = 0;
              if (business.owned_ad_accounts?.data) {
                for (const ad of business.owned_ad_accounts.data) {
                  const { error } = await supabase.from('facebook_ad_accounts').upsert({
                    id: ad.account_id,
                    business_account_id: business.id,
                    user_id: currentUser.id,
                    name: ad.name,
                    account_status: ad.account_status,
                    currency: ad.currency,
                    timezone_name: ad.timezone_name,
                    account_role: 'ADMIN',
                  });
                  if (!error) adAccountCount++;
                }
              }
              businesses.push({
                id: business.id,
                name: business.name,
                business_role: 'Admin',
                status: 'active',
                adAccountsCount: adAccountCount,
              });
            }

            setSelectedServer(backToState.serverId!);
            setBusinessAccounts(businesses);
            setSelectedBusiness(backToState.businessId!);
            sessionStorage.removeItem('backToPageFromTools');
            navigate('/dashboard/page');
          })(),
          25000
        );
      } catch {
        restoreToPageAttempted.current = false;
      }
    };

    void fetchAndRestoreToPage();
  }, [backToState, currentUser, facebookAccessToken]);

  // Initialize auth state and handle initial auth data; gate on Facebook token expiry
  useEffect(() => {
    if (!initialAuthData) return;

    setCurrentUser(initialAuthData.user);
    setUserSession(initialAuthData.session);

    // provider_token lives at top-level (authService shape) or inside session (interface shape)
    const providerToken =
      (initialAuthData as Record<string, unknown>).provider_token as string | undefined ||
      initialAuthData.session?.provider_token;

    let mounted = true;
    (async () => {
      const longLived = await loadLongLivedTokenFromDb(initialAuthData.user.id);
      if (mounted) {
        if (longLived) {
          setFacebookAccessToken(longLived);
        } else {
          const token =
            initialAuthData.facebookToken ||
            providerToken ||
            initialAuthData.session?.access_token;
          setFacebookAccessToken(token || '');
        }
      }

      // Fresh OAuth sign-in: provider_token present means old DB status is stale,
      // skip the DB check and proceed directly.
      if (providerToken) {
        if (!mounted) return;
        setFacebookTokenStatus('valid');
        await loadUserServers(initialAuthData.user.id);
        if (!mounted || restoreToPageAttempted.current) return;
        navigate('/dashboard/server');
        return;
      }

      const status = await checkFacebookTokenStatus();
      if (!mounted) return;
      setFacebookTokenStatus(status);
      if (status === 'expired') return;
      await loadUserServers(initialAuthData.user.id);
      if (!mounted || restoreToPageAttempted.current) return;
      navigate('/dashboard/server');
    })();
    return () => {
      mounted = false;
    };
  }, [initialAuthData]);

  // Session management
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      setIsLoading(true);
      try {
        await promiseWithTimeout(
          (async () => {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
              setError('Failed to retrieve session. Please try logging in again.');
              return;
            }
            if (session?.user && mounted) {
              setCurrentUser(session.user);
              setUserSession(session);
              const longLived = await loadLongLivedTokenFromDb(session.user.id);
              if (longLived) {
                setFacebookAccessToken(longLived);
              } else if (session.provider_token) {
                setFacebookAccessToken(session.provider_token);
              }

              // Fresh OAuth sign-in: provider_token present means old DB status is stale,
              // skip the DB check and proceed directly with token exchange.
              if (session.provider_token) {
                setFacebookTokenStatus('valid');
                await processAuthenticatedUser(session);
              } else {
                const tokenStatus = await checkFacebookTokenStatus();
                if (!mounted) return;
                setFacebookTokenStatus(tokenStatus);
                if (tokenStatus === 'expired') return;
                await processAuthenticatedUser(session);
              }
            }
          })(),
          25000
        );
      } catch {
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
      try {
        if (event === 'SIGNED_IN' && session?.user && mounted) {
          setCurrentUser(session.user);
          setUserSession(session);
          const longLived = await loadLongLivedTokenFromDb(session.user.id);
          if (longLived) {
            setFacebookAccessToken(longLived);
          } else if (session.provider_token) {
            setFacebookAccessToken(session.provider_token);
          }
          setFacebookTokenStatus('valid');
          await processAuthenticatedUser(session);
        } else if (event === 'SIGNED_OUT' && mounted) {
          setCurrentUser(null);
          setUserSession(null);
          setFacebookAccessToken('');
          setFacebookTokenStatus('unknown');
          navigate('/dashboard');
        } else if (event === 'TOKEN_REFRESHED' && session?.user && mounted) {
          setUserSession(session);
          const longLived = await loadLongLivedTokenFromDb(session.user.id);
          if (longLived) {
            setFacebookAccessToken(longLived);
          } else if (session.provider_token) {
            setFacebookAccessToken(session.provider_token);
          }
        }
      } catch {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- processAuthenticatedUser is stable, intentional empty deps
  }, []);

  // Helper functions
  const processAuthenticatedUser = async (session: { user: { user_metadata?: { provider_id?: string; sub?: string; full_name?: string; name?: string; avatar_url?: string; picture?: string }; email?: string; id: string }; provider_token?: string }) => {
    try {
      const user = session.user;
      const facebookData = {
        id: user.user_metadata?.provider_id || user.user_metadata?.sub,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
        email: user.email,
        picture_url: user.user_metadata?.avatar_url || user.user_metadata?.picture
      };

      await exchangeTokenAndSaveUser(session.provider_token, facebookData, user);
      setFacebookTokenStatus('valid');
      await loadUserServers(user.id);
      if (!restoreToPageAttempted.current) navigate('/dashboard/server');
    } catch (e) {
      setError(`Failed to process user data: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const exchangeTokenAndSaveUser = async (providerToken: string, facebookData: { id?: string; name?: string; email?: string; picture_url?: string }, supabaseUser: { id: string; email?: string }) => {
    try {
      if (!providerToken) {
        await saveUserToDatabase(null, facebookData, supabaseUser);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
      const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
      const response = await fetch(`${supabaseUrl}/functions/v1/exchange-facebook-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          'apikey': supabaseKey
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
        setFacebookAccessToken(data.longLivedToken);
        await saveUserToDatabase(data, facebookData, supabaseUser);
      } else {
        await saveUserToDatabase(null, facebookData, supabaseUser, providerToken);
      }

    } catch {
      await saveUserToDatabase(null, facebookData, supabaseUser, providerToken);
    }
  };

  const saveUserToDatabase = async (
    tokenData: { longLivedToken?: string; expiresAt?: string; grantedScopes?: string[] } | null,
    facebookData: { id?: string; name?: string; picture_url?: string },
    supabaseUser: { id: string; email?: string },
    fallbackToken?: string
  ) => {
    const tokenToUse = tokenData?.longLivedToken || fallbackToken || facebookAccessToken;
    const expiresAt = tokenData?.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const scopes = tokenData?.grantedScopes || ['email', 'pages_read_engagement', 'business_management', 'ads_management'];
    
    const { error: dbError } = await supabase
      .rpc('upsert_user_with_facebook_data', {
        p_user_id: supabaseUser.id,
        p_email: supabaseUser.email,
        p_name: facebookData.name,
        p_facebook_id: facebookData.id,
        p_facebook_name: facebookData.name,
        p_facebook_email: supabaseUser.email,
        p_facebook_picture_url: facebookData.picture_url,
        p_facebook_access_token: tokenToUse,
        p_facebook_long_lived_token: tokenToUse,
        p_facebook_token_expires_at: expiresAt,
        p_facebook_scopes: scopes
      });

    if (dbError) {
      throw new Error('Failed to save user data: ' + dbError.message);
    }

    // Ensure we have the token in state
    if (tokenToUse && !facebookAccessToken) {
      setFacebookAccessToken(tokenToUse);
    }
  };

  const loadUserServers = async (userId: string) => {
    try {
      const { data: serversData, error } = await supabase
        .rpc('get_user_servers', {
          p_user_id: userId
        });

      if (error) throw error;

      const serversList: Server[] = (serversData || []).map((server: { server_id: string; server_name: string; session_token: string; created_at: string; is_active: boolean }) => ({
        id: server.server_id,
        name: server.server_name,
        access_token: server.session_token,
        created_at: server.created_at,
        is_active: server.is_active
      }));

      setServers(serversList);
    } catch {
      // Servers load failed
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Sign out failed, continue
    }
  };

  // Step handlers
  const handleLoginSuccess = () => {
    // Auth state change will handle the transition
  };

  const handleServerSelected = (_serverId: string) => {
    setSelectedServer(_serverId);
    navigate('/dashboard/business');
  };

  // Handler for complete server selection with business accounts
  const handleCompleteServerSelection = (serverId: string, businessAccounts: BusinessAccount[]) => {
    setSelectedServer(serverId);
    setBusinessAccounts(businessAccounts);
    navigate('/dashboard/business');
  };

  const handleServerCreated = (newServer: Server) => {
    setServers(prev => [newServer, ...prev]);
  };

  const handleServerDeleted = (serverId: string) => {
    setServers(prev => prev.filter(s => s.id !== serverId));
    if (selectedServer === serverId) {
      setSelectedServer('');
      navigate('/dashboard/server');
    }
  };

  // Updated handler to match the new signature
  const handleBusinessSelected = async (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    serverAccessToken: string,
    _userId?: string
  ) => {
    void _userId; // Required by callback signature, not used
    if (!currentUser) return;

    // Navigate immediately so slow/hanging RPC does not block workspace (same pattern as Supabase upserts in BusinessSelectionStep)
    onServerSelected(
      serverId,
      businessId,
      adAccountId,
      pageId,
      serverAccessToken,
      currentUser.id
    );

    // Persist server–business link in background; do not block navigation
    void supabase
      .rpc('update_server_business', {
        p_server_id: serverId,
        p_business_id: businessId
      })
      .then(({ error: updateError }) => {
        if (updateError) {
          setError(`Failed to update server business: ${updateError.message}`);
        }
      })
      .catch((e) => {
        setError(`Failed to select business: ${e instanceof Error ? e.message : 'Unknown error'}`);
      });
  };

  const handleBackToServers = () => {
    setSelectedBusiness('');
    navigate('/dashboard/server');
  };

  // URL-derived sub-step for business selection (business | adaccount | page)
  const businessSubStep: 'business' | 'adaccount' | 'page' =
    pathname.startsWith('/dashboard/page')
      ? 'page'
      : pathname.startsWith('/dashboard/adaccount')
        ? 'adaccount'
        : 'business';

  // Clear error helper
  const clearError = () => setError('');

  // Get the best available Facebook token
  const getAvailableFacebookToken = () => {
    const token = facebookAccessToken || userSession?.provider_token || '';
    return token;
  };

  // Gate: require valid Facebook token before server/business steps
  if (currentUser && facebookTokenStatus === 'unknown') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
        <div className="text-center">
          <Spinner size="md" className="mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm sm:text-base">
            Checking your connection...
          </p>
        </div>
      </div>
    );
  }

  const tokenMissing = facebookTokenStatus === 'valid' && !getAvailableFacebookToken();
  if (currentUser && (facebookTokenStatus === 'expired' || tokenMissing)) {
    return (
      <LoginStep
        variant="reconnect"
        isLoading={isLoading}
        error={error}
        onLogin={handleLoginSuccess}
        onClearError={clearError}
        supabase={supabase}
      />
    );
  }

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
          onServerDeleted={handleServerDeleted}
          onLogout={handleLogout}
          onClearError={clearError}
          supabase={supabase}
          facebookAccessToken={getAvailableFacebookToken()}
          onCompleteServerSelection={handleCompleteServerSelection}
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
          facebookAccessToken={getAvailableFacebookToken()}
          error={error}
          onBusinessSelected={handleBusinessSelected}
          onBusinessSelectionChange={setSelectedBusiness}
          onBusinessAccountsChange={setBusinessAccounts}
          onBackToServers={handleBackToServers}
          onBackToBusiness={() => navigate('/dashboard/business')}
          onBackToAdAccounts={() => navigate('/dashboard/adaccount')}
          onAdvanceToAdAccount={() => navigate('/dashboard/adaccount')}
          onAdvanceToPage={() => navigate('/dashboard/page')}
          onClearError={clearError}
          supabase={supabase}
          initialStep={backToState?.backToStep === 'page' ? 'page' : businessSubStep}
          initialAdAccountId={backToState?.backToStep === 'page' ? backToState.adAccountId : undefined}
        />
      );

    default:
      return null;
  }
};

export default FacebookLogin;
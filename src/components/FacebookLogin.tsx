import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import authService, { supabase } from '../auth/authService';
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
  const initialAuthDataRef = useRef(initialAuthData);
  initialAuthDataRef.current = initialAuthData;
  /** Set when init auth effect's async has finished; prevents showing reconnect while token is still loading from DB. */
  const initAuthResolvedRef = useRef(false);
  const supabaseUrlEnv = getEnvVar('VITE_SUPABASE_URL');
  const supabaseAnonKeyEnv = getEnvVar('VITE_SUPABASE_ANON_KEY');

  useVisibilityReset(() => setIsLoading(false));

  const FACEBOOK_TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

  const checkFacebookTokenStatus = async (): Promise<'valid' | 'expired'> => {
    try {
      const { data, error: rpcError } = await promiseWithTimeout(
        (async () => {
          const result = await supabase.rpc('get_my_facebook_token_status');
          return result;
        })(),
        6000
      );
      if (rpcError || !data) return 'expired';
      const hasToken = data?.has_token === true;
      const expiresAt = data?.expires_at;
      if (!hasToken || !expiresAt) return 'expired';
      const expirationTime = new Date(expiresAt).getTime();
      const now = Date.now();
      if (expirationTime - FACEBOOK_TOKEN_BUFFER_MS <= now) return 'expired';
      return 'valid';
    } catch {
      return 'expired';
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
    if (supabaseAnonKeyEnv) headers.apikey = supabaseAnonKeyEnv;
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetchWithTimeout(`${supabaseUrlEnv}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      timeoutMs
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`RPC ${fn} failed (${response.status}): ${text.slice(0, 200)}`);
    }
    if (!text) return null as T;
    return JSON.parse(text) as T;
  };

  const runRpcWithFallback = async <T,>(
    fn: string,
    payload: Record<string, unknown>,
    timeoutMs: number
  ): Promise<{ data: T | null; error: { message: string } | null }> => {
    try {
      const sdkResult = await promiseWithTimeout(
        (async () => {
          const result = await supabase.rpc(fn, payload);
          return result;
        })(),
        timeoutMs
      );
      if (!sdkResult.error) {
        return { data: (sdkResult.data as T) ?? null, error: null };
      }
    } catch {
      // Fall through to REST fallback.
    }

    try {
      const data = await rpcViaRest<T>(fn, payload, timeoutMs);
      return { data, error: null };
    } catch (e) {
      return { error: { message: e instanceof Error ? e.message : `RPC ${fn} failed` }, data: null };
    }
  };

  /** Prefer long-lived token from DB so the frontend doesn't use short-lived session.provider_token. */
  const loadLongLivedTokenFromDb = async (userId: string): Promise<string | null> => {
    try {
      const { data, error } = await promiseWithTimeout(
        (async () => {
          const result = await supabase
            .from('users')
            .select('facebook_long_lived_token, facebook_access_token')
            .eq('id', userId)
            .maybeSingle();
          return result;
        })(),
        6000
      );
      if (error) return null;
      return data?.facebook_long_lived_token || data?.facebook_access_token || null;
    } catch {
      return null;
    }
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
  // Depend on user id (stable primitive) instead of the full object to avoid re-runs on reference changes.
  const initialAuthUserId = initialAuthData?.user?.id;
  useEffect(() => {
    const authData = initialAuthDataRef.current;
    if (!authData) return;

    setCurrentUser(authData.user);
    setUserSession(authData.session ?? null);

    // Optimistically mark token as valid so the gate doesn't block.
    // Dashboard already verified auth; async work below will correct to 'expired' if needed.
    setFacebookTokenStatus('valid');

    const providerToken =
      (authData as Record<string, unknown>).provider_token as string | undefined ||
      authData.session?.provider_token;

    let mounted = true;
    initAuthResolvedRef.current = false;
    (async () => {
      try {
        const longLived = await loadLongLivedTokenFromDb(authData.user.id);
        if (mounted) {
          if (longLived) {
            setFacebookAccessToken(longLived);
          } else {
            const token =
              authData.facebookToken ||
              providerToken ||
              authData.session?.access_token;
            setFacebookAccessToken(token || '');
          }
        }

        if (providerToken) {
          if (!mounted) return;
          await loadUserServersBestEffort(authData.user.id);
          if (!mounted || restoreToPageAttempted.current) return;
          navigate('/dashboard/server');
          return;
        }

        // When we have a token from DB, trust it — don't overwrite with RPC result (avoids reconnect every time).
        if (longLived) {
          if (!mounted) return;
          await loadUserServersBestEffort(authData.user.id);
          if (!mounted || restoreToPageAttempted.current) return;
          navigate('/dashboard/server');
          return;
        }

        const status = await checkFacebookTokenStatus();
        if (!mounted) return;
        setFacebookTokenStatus(status);
        if (status === 'expired') return;
        await loadUserServersBestEffort(authData.user.id);
        if (!mounted || restoreToPageAttempted.current) return;
        navigate('/dashboard/server');
      } finally {
        if (mounted) initAuthResolvedRef.current = true;
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAuthUserId]);

  // Session management
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      setError('');
      setIsLoading(true);
      try {
        await promiseWithTimeout(
          (async () => {
            let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
            let error: Awaited<ReturnType<typeof supabase.auth.getSession>>['error'] | null = null;
            try {
              const result = await supabase.auth.getSession();
              session = result.data?.session ?? null;
              error = result.error ?? null;
            } catch (getSessionError) {
              // getSession() can throw when localStorage is blocked (e.g. private browsing) or client fails
              if (mounted) {
                setError('Could not read session. Please sign in again or disable blocking for this site.');
              }
              return;
            }
            if (error) {
              setError('Failed to retrieve session. Please try logging in again.');
              return;
            }
            if (session?.user && mounted) {
              setCurrentUser(session.user);
              setUserSession(session ? { provider_token: session.provider_token ?? undefined } : null);
              const longLived = await loadLongLivedTokenFromDb(session.user.id);
              if (longLived) {
                setFacebookAccessToken(longLived);
              } else if (session.provider_token) {
                setFacebookAccessToken(session.provider_token);
              }

              // Fresh OAuth sign-in: provider_token present means old DB status is stale,
              // skip the DB check and proceed directly with token exchange.
              const sessionForProcess = session ? { user: session.user, provider_token: session.provider_token ?? undefined } : null;
              if (session.provider_token && sessionForProcess) {
                setFacebookTokenStatus('valid');
                await processAuthenticatedUser(sessionForProcess);
              } else {
                const tokenStatus = await checkFacebookTokenStatus();
                if (!mounted) return;
                setFacebookTokenStatus(tokenStatus);
                if (tokenStatus === 'expired') return;
                if (sessionForProcess) await processAuthenticatedUser(sessionForProcess);
              }
            }
          })(),
          25000
        );
      } catch (e) {
        if (mounted) {
          const msg = e instanceof Error ? e.message : String(e);
          const isTimeout = /timed out|timeout/i.test(msg);
          setError(
            isTimeout
              ? 'Session check timed out. Please refresh the page or check your connection.'
              : `Session error: ${msg}. Please refresh the page.`
          );
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
          setUserSession(session ? { provider_token: session.provider_token ?? undefined } : null);
          const longLived = await loadLongLivedTokenFromDb(session.user.id);
          if (longLived) {
            setFacebookAccessToken(longLived);
          } else if (session.provider_token) {
            setFacebookAccessToken(session.provider_token);
          }
          setFacebookTokenStatus('valid');
          await processAuthenticatedUser({ user: session.user, provider_token: session.provider_token ?? undefined });
        } else if (event === 'SIGNED_OUT' && mounted) {
          setCurrentUser(null);
          setUserSession(null);
          setFacebookAccessToken('');
          setFacebookTokenStatus('unknown');
          navigate('/');
        } else if (event === 'TOKEN_REFRESHED' && session?.user && mounted) {
          setUserSession(session ? { provider_token: session.provider_token ?? undefined } : null);
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

    // Skip checkSession when initialAuthData is provided — initAuthEffect handles that case.
    // checkSession is only needed for cold starts (page refresh / direct navigation).
    if (!initialAuthDataRef.current) {
      checkSession();
    }

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
      await loadUserServersBestEffort(user.id);
      if (!restoreToPageAttempted.current) navigate('/dashboard/server');
    } catch (e) {
      setError(`Failed to process user data: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const exchangeTokenAndSaveUser = async (providerToken: string | undefined | null, facebookData: { id?: string; name?: string; email?: string; picture_url?: string }, supabaseUser: { id: string; email?: string }) => {
    try {
      if (!providerToken) {
        // No provider_token = magic-link session (custom Facebook flow).
        // The auth-facebook Edge Function already saved token + profile to DB.
        // Just load the long-lived token from DB so the dashboard can use it.
        const dbToken = await loadLongLivedTokenFromDb(supabaseUser.id);
        if (dbToken) setFacebookAccessToken(dbToken);
        return;
      }

      const { data: { session } } = await promiseWithTimeout(
        (async () => {
          const result = await supabase.auth.getSession();
          return result;
        })(),
        6000
      );
      
      const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
      const supabaseKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || supabaseKey || ''}`,
      };
      if (supabaseKey) headers['apikey'] = supabaseKey;
      const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/exchange-facebook-token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shortLivedToken: providerToken,
          userId: supabaseUser.id
        }),
        timeoutMs: 12000
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setFacebookAccessToken(data.longLivedToken);
        await saveUserToDatabase(data, facebookData, supabaseUser);
      } else {
        await saveUserToDatabase(null, facebookData, supabaseUser, providerToken ?? undefined);
      }

    } catch {
      await saveUserToDatabase(null, facebookData, supabaseUser, providerToken ?? undefined);
    }
  };

  const saveUserToDatabase = async (
    tokenData: { longLivedToken?: string; expiresAt?: string; grantedScopes?: string[] } | null,
    facebookData: { id?: string; name?: string; picture_url?: string },
    supabaseUser: { id: string; email?: string | null },
    fallbackToken?: string
  ) => {
    // When tokenData is null (exchange failed or success: false), do NOT write token or expiry —
    // otherwise we overwrite the existing long-lived token and 60-day expiry with short-lived token
    // and 2-hour expiry, causing "connection expired" after 2 hours.
    const tokenToUse =
      tokenData != null ? (tokenData.longLivedToken ?? fallbackToken ?? facebookAccessToken) : undefined;
    const expiresAt =
      tokenData != null
        ? (tokenData.expiresAt ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString())
        : undefined;

    if (!tokenToUse && !facebookData.id && !facebookData.name) {
      return;
    }

    const scopes = tokenData?.grantedScopes ?? ['email', 'pages_read_engagement', 'business_management', 'ads_management'];
    const str = (v: string | null | undefined): string | undefined => (v == null ? undefined : v);
    const { error: dbError } = await promiseWithTimeout(
      (async () => {
        const result = await supabase.rpc('upsert_user_with_facebook_data', {
          p_user_id: supabaseUser.id,
          p_email: str(supabaseUser.email),
          p_name: str(facebookData.name),
          p_facebook_id: str(facebookData.id),
          p_facebook_name: str(facebookData.name),
          p_facebook_email: str(supabaseUser.email),
          p_facebook_picture_url: str(facebookData.picture_url),
          p_facebook_access_token: str(tokenToUse ?? undefined),
          p_facebook_long_lived_token: str(tokenToUse ?? undefined),
          p_facebook_token_expires_at: expiresAt ?? undefined,
          p_facebook_scopes: scopes,
        });
        return result;
      })(),
      10000
    );

    if (dbError) {
      throw new Error('Failed to save user data: ' + dbError.message);
    }

    if (tokenToUse && !facebookAccessToken) {
      setFacebookAccessToken(tokenToUse);
    }
  };

  const loadUserServers = async (userId: string): Promise<Server[]> => {
    try {
      const { data: withSettingsData, error: withSettingsError } = await runRpcWithFallback<Array<{
        server_id: string;
        server_name: string;
        session_token: string;
        created_at: string;
        is_active: boolean;
        settings?: ServerSettings;
        description?: string | null;
      }>>('get_user_servers_with_settings', { p_user_id: userId }, 8000);

      if (!withSettingsError && withSettingsData && withSettingsData.length > 0) {
        const serversList: Server[] = withSettingsData.map((s) => ({
          id: s.server_id,
          name: s.server_name,
          access_token: s.session_token ?? '',
          created_at: s.created_at,
          is_active: s.is_active ?? true,
          settings: s.settings ?? undefined,
          description: s.description ?? undefined
        })).filter((s) => s.access_token);
        setServers(serversList);
        return serversList;
      }

      const { data: serversData, error } = await runRpcWithFallback<Array<{
        server_id: string;
        server_name: string;
        session_token: string;
        created_at: string;
        is_active: boolean;
      }>>('get_user_servers', { p_user_id: userId }, 8000);
      if (error) throw error;

      const serversList: Server[] = (serversData || []).map((server) => ({
        id: server.server_id,
        name: server.server_name,
        access_token: server.session_token,
        created_at: server.created_at,
        is_active: server.is_active
      }));
      setServers(serversList);
      return serversList;
    } catch {
      // Servers load failed
      return [];
    }
  };

  const loadUserServersBestEffort = async (userId: string): Promise<void> => {
    try {
      await promiseWithTimeout(loadUserServers(userId), 10000);
    } catch {
      // Keep route transitions responsive; list can refresh later.
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      authService.clearAuth();
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

  // Go straight to workspace using last saved business/ad account/page for this server
  const handleContinueWithLastWorkspace = (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    serverAccessToken: string
  ) => {
    if (!currentUser) return;
    handleBusinessSelected(serverId, businessId, adAccountId, pageId, serverAccessToken, currentUser.id);
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

  const handleRefreshServers = async () => {
    if (!currentUser?.id) return;
    try {
      await promiseWithTimeout(loadUserServers(currentUser.id), 8000);
    } catch {
      // Keep optimistic UI behavior; refresh is best-effort.
    }
  };

  const persistServerSettings = async (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    names?: { businessName: string; adAccountName: string; pageName: string }
  ): Promise<{ error: { message: string } | null }> => {
    const token = getStoredAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (supabaseAnonKeyEnv) headers.apikey = supabaseAnonKeyEnv;
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await fetchWithTimeout(`${supabaseUrlEnv}/rest/v1/rpc/update_server_settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_server_id: serverId,
          p_settings: {
            last_workspace: {
              business_id: businessId,
              business_name: names?.businessName,
              ad_account_id: adAccountId,
              ad_account_name: names?.adAccountName,
              page_id: pageId,
              page_name: names?.pageName
            }
          }
        }),
        timeoutMs: 12000
      });

      if (!response.ok) {
        const body = await response.text();
        return { error: { message: `Failed to save workspace (${response.status}): ${body.slice(0, 180)}` } };
      }

      return { error: null };
    } catch (e) {
      return { error: { message: e instanceof Error ? e.message : 'Failed to save workspace' } };
    }
  };

  const handleBusinessSelected = async (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    serverAccessToken: string,
    _userId?: string,
    names?: { businessName: string; adAccountName: string; pageName: string }
  ) => {
    void _userId;
    if (!currentUser) return;

    onServerSelected(
      serverId,
      businessId,
      adAccountId,
      pageId,
      serverAccessToken,
      currentUser.id
    );

    void promiseWithTimeout(persistServerSettings(serverId, businessId, adAccountId, pageId, names), 10000)
      .then(({ error: settingsError }: { error: { message: string } | null }) => {
        if (settingsError) {
          setError((prev) => prev || `Failed to save workspace: ${settingsError.message}`);
        }
      })
      .catch((e: unknown) => {
        setError(`Failed to select business: ${e instanceof Error ? e.message : 'Unknown error'}`);
      });
  };

  const handleSaveServer = async (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    _serverAccessToken: string,
    _userId?: string,
    names?: { businessName: string; adAccountName: string; pageName: string }
  ): Promise<void> => {
    void _serverAccessToken;
    void _userId;
    if (!currentUser) return;

    // Update UI immediately to avoid long "Saving..." spinners if backend is slow.
    setServers(prev => prev.map(s =>
      s.id === serverId
        ? {
            ...s,
            settings: {
              ...s.settings,
              last_workspace: {
                business_id: businessId,
                business_name: names?.businessName,
                ad_account_id: adAccountId,
                ad_account_name: names?.adAccountName,
                page_id: pageId,
                page_name: names?.pageName
              }
            }
          }
        : s
    ));
    navigate('/dashboard/server');

    void promiseWithTimeout(persistServerSettings(serverId, businessId, adAccountId, pageId, names), 10000)
      .then(({ error: settingsError }) => {
        if (settingsError) {
          setError(`Saved locally, but cloud save failed: ${settingsError.message}`);
          return;
        }
        void handleRefreshServers();
      })
      .catch((e: unknown) => {
        setError(`Saved locally, but cloud save failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
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
  /** Don't show reconnect while init effect is still loading token from DB (valid status but token not in state yet). */
  const initStillLoading = !!(initialAuthUserId && tokenMissing && !initAuthResolvedRef.current);
  if (initStillLoading) {
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
      if (!currentUser) return null;
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
          onContinueWithLastWorkspace={handleContinueWithLastWorkspace}
          onRefreshServers={handleRefreshServers}
        />
      );

    case 'business-selection':
      if (!currentUser) return null;
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
          onSaveServer={handleSaveServer}
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
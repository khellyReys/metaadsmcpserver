// src/auth/authService.js - Fixed version
import { createClient } from '@supabase/supabase-js';
import { getEnvVar } from '../lib/env';

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase env vars are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file in the project root (same folder as vite.config.ts), then restart the dev server (npm run dev).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

class AuthService {
  constructor() {
    this.tokenKey = 'authData';
    this.refreshInProgress = false;
    this.authSubscription = null; // Track subscription to prevent duplicates
    this.timeouts = {
      session: 7000,
      user: 8000,
      db: 8000,
      auth: 12000,
      fetch: 15000,
    };
  }

  withTimeout(promise, ms, label = 'Request') {
    return new Promise((resolve, reject) => {
      const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      Promise.resolve(promise)
        .then((v) => {
          clearTimeout(id);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(id);
          reject(e);
        });
    });
  }

  // Get stored auth data
  getStoredAuth() {
    try {
      const stored = localStorage.getItem(this.tokenKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      this.clearAuth();
      return null;
    }
  }

  // Store auth data
  setStoredAuth(authData) {
    try {
      localStorage.setItem(this.tokenKey, JSON.stringify(authData));
      return true;
    } catch (error) {
      return false;
    }
  }

  // Clear auth data
  clearAuth() {
    localStorage.removeItem(this.tokenKey);
    // Don't automatically sign out from Supabase here to prevent loops
  }

  // Check if token is expired (with 5-minute buffer)
  isTokenExpired(authData) {
    if (!authData?.expires_at) return false;
    
    const expirationTime = new Date(authData.expires_at).getTime();
    const currentTime = new Date().getTime();
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    
    return (expirationTime - bufferTime) <= currentTime;
  }

  // Validate token using Supabase
  async validateToken(accessToken) {
    try {
      const { data: { user }, error } = await this.withTimeout(
        supabase.auth.getUser(accessToken),
        this.timeouts.user,
        'Token validation'
      );

      if (error || !user) {
        return { isValid: false, error: error?.message || 'Invalid token' };
      }

      let picture = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      let name = user.user_metadata?.full_name || user.user_metadata?.name || user.email;

      // Fallback: load profile from public.users if user_metadata has no picture
      if (!picture) {
        try {
          const { data: dbUser } = await this.withTimeout(
            supabase
              .from('users')
              .select('facebook_picture_url, facebook_name')
              .eq('id', user.id)
              .maybeSingle(),
            this.timeouts.db,
            'Profile enrichment'
          );
          if (dbUser?.facebook_picture_url) picture = dbUser.facebook_picture_url;
          if (!name && dbUser?.facebook_name) name = dbUser.facebook_name;
        } catch {
          // Best-effort fallback
        }
      }

      return { 
        isValid: true, 
        userData: {
          id: user.id,
          email: user.email,
          name,
          picture,
          verified: user.email_confirmed_at ? true : false,
          last_sign_in: user.last_sign_in_at
        }
      };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  // Refresh access token using Supabase
  async refreshToken(refreshToken) {
    if (this.refreshInProgress) {
      return new Promise((resolve, reject) => {
        const maxWait = 10_000;
        const start = Date.now();
        const checkRefresh = () => {
          if (!this.refreshInProgress) {
            resolve(this.getStoredAuth());
          } else if (Date.now() - start > maxWait) {
            reject(new Error('Timed out waiting for token refresh'));
          } else {
            setTimeout(checkRefresh, 100);
          }
        };
        checkRefresh();
      });
    }

    this.refreshInProgress = true;

    try {
      const { data, error } = await this.withTimeout(
        supabase.auth.refreshSession({
          refresh_token: refreshToken
        }),
        this.timeouts.auth,
        'Session refresh'
      );

      if (error || !data.session) {
        return { success: false, error: error?.message || 'Token refresh failed' };
      }

      const newAuthData = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: new Date(Date.now() + data.session.expires_in * 1000).toISOString(),
        token_type: 'bearer',
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email,
          picture: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
          verified: data.user.email_confirmed_at ? true : false
        }
      };

      this.setStoredAuth(newAuthData);
      return { success: true, authData: newAuthData };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      this.refreshInProgress = false;
    }
  }

  // Main validation function with refresh logic
  async validateAuthData(authData) {
    if (!authData) {
      return { isValid: false, error: 'No auth data provided' };
    }

    // Check if we have required fields
    if (!authData.access_token) {
      return { isValid: false, error: 'No access token found' };
    }

    // Check if token is expired
    if (this.isTokenExpired(authData)) {
      
      if (authData.refresh_token) {
        const refreshResult = await this.refreshToken(authData.refresh_token);
        
        if (refreshResult.success) {
          return { isValid: true, authData: refreshResult.authData };
        } else {
          return { isValid: false, error: 'Token expired and refresh failed' };
        }
      } else {
        return { isValid: false, error: 'Token expired and no refresh token available' };
      }
    }

    // Validate token with Supabase
    const validationResult = await this.validateToken(authData.access_token);
    
    if (validationResult.isValid) {
      return { 
        isValid: true, 
        authData: authData,
        userData: validationResult.userData 
      };
    }

    // If validation failed but we have a refresh token, try refreshing
    if (authData.refresh_token) {
      const refreshResult = await this.refreshToken(authData.refresh_token);
      
      if (refreshResult.success) {
        return { isValid: true, authData: refreshResult.authData };
      }
    }

    return { isValid: false, error: validationResult.error || 'Token validation failed' };
  }

  // Logout function
  async logout() {
    try {
      // Clear subscription first
      if (this.authSubscription) {
        this.authSubscription.unsubscribe();
        this.authSubscription = null;
      }
      
      // Sign out from Supabase
      const { error } = await this.withTimeout(
        supabase.auth.signOut(),
        this.timeouts.auth,
        'Logout'
      );
      
      if (error) {
        console.error('[authService] signOut error:', error.message);
      }
    } catch (error) {
      console.error('[authService] logout error:', error?.message ?? error);
    } finally {
      // Always clear local auth data
      this.clearAuth();
    }

    return { success: true };
  }

  // Check authentication status
  async checkAuthStatus() {
    try {
      // First check Supabase session
      const { data: { session }, error } = await this.withTimeout(
        supabase.auth.getSession(),
        this.timeouts.session,
        'Session lookup'
      );
      
      if (error) {
        this.clearAuth();
        return { isAuthenticated: false, error: error.message };
      }

      if (session) {
        let picture = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;
        let userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email;

        // Fallback: load profile from public.users if user_metadata has no picture
        if (!picture) {
          try {
            const { data: dbUser } = await this.withTimeout(
              supabase
                .from('users')
                .select('facebook_picture_url, facebook_name')
                .eq('id', session.user.id)
                .maybeSingle(),
              this.timeouts.db,
              'Session profile enrichment'
            );
            if (dbUser?.facebook_picture_url) picture = dbUser.facebook_picture_url;
            if ((!userName || userName === session.user.email) && dbUser?.facebook_name) userName = dbUser.facebook_name;
          } catch {
            // Best-effort fallback
          }
        }

        const authData = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: new Date(Date.now() + session.expires_in * 1000).toISOString(),
          token_type: 'bearer',
          provider_token: session.provider_token,
          user: {
            id: session.user.id,
            email: session.user.email,
            name: userName,
            picture,
            verified: session.user.email_confirmed_at ? true : false
          }
        };

        this.setStoredAuth(authData);
        
        return { 
          isAuthenticated: true, 
          authData: authData,
          userData: authData.user 
        };
      }

      // No Supabase session, check stored auth
      const storedAuth = this.getStoredAuth();
      
      if (!storedAuth) {
        return { isAuthenticated: false, error: 'No stored authentication' };
      }

      const validationResult = await this.validateAuthData(storedAuth);
      
      if (validationResult.isValid) {
        // Update stored auth if it was refreshed
        if (validationResult.authData !== storedAuth) {
          this.setStoredAuth(validationResult.authData);
        }
        
        return { 
          isAuthenticated: true, 
          authData: validationResult.authData,
          userData: validationResult.userData 
        };
      }

      // Clear invalid auth data
      this.clearAuth();
      return { isAuthenticated: false, error: validationResult.error };
    } catch (error) {
      this.clearAuth();
      return { isAuthenticated: false, error: error.message };
    }
  }

  // Create authenticated fetch wrapper for Supabase RLS
  async authenticatedFetch(url, options = {}) {
    const { data: { session } } = await this.withTimeout(
      supabase.auth.getSession(),
      this.timeouts.session,
      'Authenticated fetch session lookup'
    );
    
    if (!session?.access_token) {
      throw new Error('No authentication token available');
    }

    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeouts.fetch);
    try {
      return await fetch(url, { ...authOptions, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Sign in with OAuth (Facebook, Google, etc.)
  async signInWithOAuth(provider, options = {}) {
    try {
      const { data, error } = await this.withTimeout(
        supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/dashboard`,
            ...options
          }
        }),
        this.timeouts.auth,
        'OAuth sign-in'
      );

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Listen for auth state changes - PREVENT MULTIPLE SUBSCRIPTIONS
  onAuthStateChange(callback) {
    // Clean up existing subscription first
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
    }

    // Create new subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      
      if (session) {
        const authData = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: new Date(Date.now() + session.expires_in * 1000).toISOString(),
          token_type: 'bearer',
          provider_token: session.provider_token,
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email,
            picture: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
            verified: session.user.email_confirmed_at ? true : false
          }
        };
        
        this.setStoredAuth(authData);
        callback(event, authData);
      } else {
        this.clearAuth();
        callback(event, null);
      }
    });

    // Store subscription reference
    this.authSubscription = subscription;
    
    return { data: { subscription } };
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
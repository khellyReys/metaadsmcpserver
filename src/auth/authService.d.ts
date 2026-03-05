import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthUserData {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
  verified?: boolean;
}

export interface CheckAuthResult {
  isAuthenticated: boolean;
  error?: string;
  authData?: unknown;
  userData?: AuthUserData;
}

declare const authService: {
  checkAuthStatus(): Promise<CheckAuthResult>;
  logout(): Promise<void>;
  clearAuth(): void;
};

export const supabase: SupabaseClient;
export default authService;

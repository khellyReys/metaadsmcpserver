import React, { useState } from 'react';
import { Facebook, ArrowRight, AlertCircle } from 'lucide-react';
import { SupabaseClient } from '@supabase/supabase-js';
import { getEnvVar } from '../lib/env';
import Spinner from './Spinner';

interface LoginStepProps {
  isLoading: boolean;
  error: string;
  onLogin: () => void;
  onClearError: () => void;
  supabase: SupabaseClient;
  /** When 'reconnect', shows expired-Facebook messaging and "Reconnect with Facebook" */
  variant?: 'connect' | 'reconnect';
}

const LoginStep: React.FC<LoginStepProps> = ({
  isLoading,
  error,
  onLogin,
  onClearError,
  supabase,
  variant = 'connect',
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const handleFacebookLogin = async () => {
    onClearError();
    setConfigError(null);
    setIsAuthenticating(true);

    try {
      const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
      const appId = getEnvVar('VITE_FACEBOOK_APP_ID');
      const isLocalhost = typeof window !== 'undefined' && /^https?:\/\/localhost(:\d+)?$/.test(window.location.origin);
      const appRedirect = isLocalhost
        ? window.location.origin
        : (getEnvVar('VITE_APP_URL') || (typeof window !== 'undefined' ? window.location.origin : ''));
      const redirectBack = `${appRedirect}/dashboard`;

      // Custom Facebook OAuth: no email required. Redirect to our Edge Function callback.
      const callbackUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/auth-facebook` : null;
      if (!callbackUrl || !appId) {
        setIsAuthenticating(false);
        setConfigError('Missing VITE_SUPABASE_URL or VITE_FACEBOOK_APP_ID. Add them to your environment.');
        return;
      }

      const state = encodeURIComponent(JSON.stringify({ redirect: redirectBack }));
      const scope = 'pages_read_engagement pages_manage_posts pages_show_list business_management ads_management ads_read';
      const fbAuthUrl = `https://www.facebook.com/v22.0/dialog/oauth?` +
        `client_id=${appId}&` +
        `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${state}`;

      onLogin();
      window.location.href = fbAuthUrl;
    } catch {
      setIsAuthenticating(false);
    }
  };

  const showLoading = isLoading || isAuthenticating;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Facebook className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {variant === 'reconnect' ? 'Reconnect Your Account' : 'Connect Your Account'}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              {variant === 'reconnect'
                ? 'Your Facebook connection has expired. Please reconnect to continue using the dashboard.'
                : 'Access your Business Manager accounts and start automating your ads.'}
            </p>
          </div>

          {/* Error Display */}
          {(error || configError) && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-800 dark:text-red-300 text-sm">{error || configError}</p>
              </div>
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleFacebookLogin}
            disabled={showLoading}
            className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showLoading ? (
              <>
                <Spinner size="sm" variant="white" />
                <span>
                  {isAuthenticating ? 'Connecting to Facebook...' : 'Redirecting to Facebook...'}
                </span>
              </>
            ) : (
              <>
                <Facebook className="w-5 h-5" />
                <span>{variant === 'reconnect' ? 'Reconnect with Facebook' : 'Continue with Facebook'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Terms */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              By continuing, you agree to our{' '}
              <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a>
            </p>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              {variant === 'reconnect' ? 'What happens next:' : 'What happens next:'}
            </h3>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              {variant === 'reconnect' ? (
                <>
                  <li>• You'll be redirected to Facebook to re-authorize</li>
                  <li>• We'll update your connection and bring you back to the dashboard</li>
                </>
              ) : (
                <>
                  <li>• You'll be redirected to Facebook to authorize</li>
                  <li>• We'll securely exchange your tokens</li>
                  <li>• You'll be brought back to your dashboard</li>
                  <li>• Then you can create your MCP server</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginStep;
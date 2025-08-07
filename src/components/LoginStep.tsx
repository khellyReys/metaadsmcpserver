import React from 'react';
import { Facebook, ArrowRight, AlertCircle } from 'lucide-react';
import { SupabaseClient } from '@supabase/supabase-js';

interface LoginStepProps {
  isLoading: boolean;
  error: string;
  onLogin: () => void;
  onClearError: () => void;
  supabase: SupabaseClient;
}

const LoginStep: React.FC<LoginStepProps> = ({
  isLoading,
  error,
  onLogin,
  onClearError,
  supabase
}) => {
  const handleFacebookLogin = async () => {
    onClearError();

    try {
      const frontendUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const redirectUrl = `${frontendUrl}/login`;
      
      console.log('OAuth redirect URL:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          scopes: 'email pages_read_engagement pages_manage_posts pages_show_list business_management ads_management ads_read',
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        throw error;
      }

      // OAuth redirect will happen automatically
      onLogin();
      
    } catch (err) {
      console.error('Facebook OAuth error:', err);
      // Error will be handled by parent component through auth state changes
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Facebook className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Connect Your Facebook Account
            </h1>
            <p className="text-gray-600">
              Sign in with Facebook to access your Business Manager accounts and start automating your ads.
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Login Button */}
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

          {/* Terms */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              By continuing, you agree to our{' '}
              <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
            </p>
          </div>

          {/* Info Box */}
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
};

export default LoginStep;
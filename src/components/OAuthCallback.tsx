import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface OAuthCallbackProps {
  onAuthComplete: (userData: any) => void;
  onError: (error: string) => void;
}

const OAuthCallback: React.FC<OAuthCallbackProps> = ({ onAuthComplete, onError }) => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing your Facebook login...');
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Update progress
        setProgress(20);
        setMessage('Validating authentication...');

        // Check URL parameters first
        const hash = window.location.hash;
        
        console.log('OAuth callback - URL hash:', hash);

        // Get the current session
        setProgress(40);
        setMessage('Establishing secure session...');
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw new Error(`Session error: ${sessionError.message}`);
        }

        if (!session) {
          // Try to get session from URL parameters
          console.log('No session found, checking URL parameters...');
          
          // Wait a bit for Supabase to process the tokens
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Try getting session again
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
          
          if (retrySession) {
            console.log('Session established after retry');
            await processSession(retrySession);
            return;
          } else {
            throw new Error('Failed to establish session with provided tokens');
          }
        }

        await processSession(session);

      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Authentication failed');
        onError(error instanceof Error ? error.message : 'Authentication failed');
        
        // Redirect to home page after error
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    };

    const processSession = async (session: any) => {
      try {
        setProgress(60);
        setMessage('Processing Facebook data...');

        const user = session.user;
        const facebookToken = session.provider_token;

        if (!facebookToken) {
          throw new Error('No Facebook access token received');
        }

        // Extract Facebook user data
        const facebookData = {
          id: user.user_metadata?.provider_id || user.user_metadata?.sub,
          name: user.user_metadata?.full_name || user.user_metadata?.name,
          email: user.email,
          picture_url: user.user_metadata?.avatar_url || user.user_metadata?.picture
        };

        console.log('Processing Facebook user:', facebookData);

        setProgress(100);
        setMessage('Authentication successful!');
        setStatus('success');

        // Clear URL parameters
        window.history.replaceState(null, '', window.location.pathname);

        // Wait a moment to show success, then redirect
        setTimeout(() => {
          onAuthComplete({
            user: user,
            session: session,
            facebookToken: facebookToken,
            facebookData: facebookData
          });
        }, 1500);

      } catch (error) {
        throw error;
      }
    };

    handleOAuthCallback();
  }, [onAuthComplete, onError, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            {/* Status Icon */}
            <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              {status === 'processing' && (
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                  <Loader className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              )}
              {status === 'success' && (
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              )}
              {status === 'error' && (
                <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
              )}
            </div>

            {/* Status Message */}
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {status === 'processing' && 'Connecting to Facebook'}
              {status === 'success' && 'Successfully Connected!'}
              {status === 'error' && 'Connection Failed'}
            </h1>

            <p className="text-gray-600 mb-6">{message}</p>

            {/* Progress Bar */}
            {status === 'processing' && (
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="text-sm text-gray-500 mt-2">{progress}% complete</div>
              </div>
            )}

            {/* Success Message */}
            {status === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 text-sm">
                  Your Facebook account has been successfully connected. Redirecting to your dashboard...
                </p>
              </div>
            )}

            {/* Error Message */}
            {status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800 text-sm mb-3">{message}</p>
                <button
                  onClick={() => navigate('/')}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Return to Home
                </button>
              </div>
            )}

            {/* Loading indicator */}
            {status === 'processing' && (
              <div className="text-sm text-gray-500">
                Please wait while we set up your account...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;
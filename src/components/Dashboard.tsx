import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FacebookLogin from './FacebookLogin';
import Spinner from './Spinner';
import ThemeToggle from './ThemeToggle';
import authService from '../auth/authService';
import { promiseWithTimeout } from '../lib/asyncUtils';
import { useVisibilityReset } from '../hooks/useVisibilityReset';

const BACK_TO_PAGE_FLAG = 'backToPageFromTools';

interface UserProfile {
  id?: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface AuthData {
  user?: UserProfile;
  access_token?: string;
  [key: string]: unknown;
}

interface DashboardProps {
  onServerSelected: (
    serverId: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    serverAccessToken: string,
    userId?: string
  ) => void;
  onLogout?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onServerSelected, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authData, setAuthData] = useState<AuthData | null>(null);

  useVisibilityReset(() => setIsLoading(false));

  const pathname = location.pathname;

  // Clear stale location.state on reload so we don't restore to Page step (state can persist across reload)
  useEffect(() => {
    const state = location.state as { backToStep?: string } | undefined;
    if (state?.backToStep === 'page' && sessionStorage.getItem(BACK_TO_PAGE_FLAG) !== '1') {
      navigate('/dashboard/page', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // Single auth check - NO AUTH STATE LISTENER HERE
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        setAuthError(null);

        const authStatus = await authService.checkAuthStatus();
        
        if (authStatus.isAuthenticated) {
          setIsAuthenticated(true);
          setUserProfile(authStatus.userData);
          setAuthData(authStatus.authData || authStatus.userData);
        } else {
          setIsAuthenticated(false);
          setUserProfile(null);
          setAuthData(null);
          
          if (authStatus.error && authStatus.error !== 'No stored authentication') {
            setAuthError(authStatus.error);
          }
        }
      } catch {
        setIsAuthenticated(false);
        setUserProfile(null);
        setAuthData(null);
        setAuthError('Authentication check failed. Please try again.');
        
        authService.clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []); // IMPORTANT: Empty dependency array to prevent loops

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      
      await promiseWithTimeout(authService.logout(), 15000);
      
      // Clear parent state (workspace selection)
      onLogout?.();
      
      // Update local state
      setAuthData(null);
      setIsAuthenticated(false);
      setUserProfile(null);
      setAuthError(null);
      
      navigate('/');
    } catch {
      // Force clear local state even if server logout failed
      authService.clearAuth();
      setAuthData(null);
      setIsAuthenticated(false);
      setUserProfile(null);
      
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryAuth = () => {
    setAuthError(null);
    setIsLoading(true);
    
    // Clear any corrupted data and retry
    authService.clearAuth();
    setAuthData(null);
    
    // The useEffect will automatically trigger auth check
    window.location.reload();
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
        <div className="text-center">
          <Spinner size="md" className="mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-300 text-sm sm:text-base">
            {isAuthenticated ? 'Loading dashboard...' : 'Checking authentication...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (authError && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-4">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400 dark:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                  Authentication Error
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                  {authError}
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleRetryAuth}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base"
            >
              Retry Authentication
            </button>
            
            <button
              onClick={() => navigate('/')}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Redirect authenticated users from /dashboard (or /dashboard/) to /dashboard/server
  if (isAuthenticated && (pathname === '/dashboard' || pathname === '/dashboard/')) {
    navigate('/dashboard/server', { replace: true });
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <Spinner size="md" className="mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Redirect unauthenticated users from dashboard sub-routes to /dashboard (login)
  if (!isAuthenticated && pathname !== '/dashboard' && pathname !== '/dashboard/') {
    navigate('/dashboard', { replace: true });
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <Spinner size="md" className="mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // If authenticated, render the FacebookLogin component (step driven by URL)
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Header with profile and logout - sticky so it stays above content when scrolling */}
        {userProfile && (
          <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {userProfile.picture && (
                    <img
                      src={userProfile.picture}
                      alt={userProfile.name}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shrink-0"
                    />
                  )}
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{userProfile.name || userProfile.email}</p>
                    {userProfile.email && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userProfile.email}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors shrink-0"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <FacebookLogin 
          onServerSelected={onServerSelected} 
          initialAuthData={authData}
          pathname={pathname}
          backToState={(() => {
            const rawState = location.state as { backToStep?: string; serverId?: string; businessId?: string; adAccountId?: string } | undefined;
            const flag = sessionStorage.getItem(BACK_TO_PAGE_FLAG);
            // Pass state when flag is set; FacebookLogin removes flag after restore so we don't pass undefined on the next render
            const backToState = rawState?.backToStep === 'page' && flag === '1'
              ? rawState
              : rawState?.backToStep === 'page'
                ? undefined
                : rawState;
            return backToState;
          })()}
        />
      </div>
    );
  }

  // Show FacebookLogin if not authenticated (login step at /dashboard)
  return (
    <FacebookLogin 
      onServerSelected={onServerSelected} 
      initialAuthData={null}
      pathname={pathname}
    />
  );
};

export default Dashboard;
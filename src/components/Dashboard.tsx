import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FacebookLogin from './FacebookLogin';
import authService from '../auth/authService';

interface DashboardProps {
  onServerSelected: (serverId: string, businessId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onServerSelected }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [authData, setAuthData] = useState<any>(null);

  // Single auth check - NO AUTH STATE LISTENER HERE
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        setAuthError(null);

        // Use the auth service to check authentication status
        const authStatus = await authService.checkAuthStatus();
        
        if (authStatus.isAuthenticated) {
          setIsAuthenticated(true);
          setUserProfile(authStatus.userData);
          setAuthData(authStatus.authData);
        } else {
          setIsAuthenticated(false);
          setUserProfile(null);
          setAuthData(null);
          
          // Set error message for user
          if (authStatus.error && authStatus.error !== 'No stored authentication') {
            setAuthError(authStatus.error);
          }
        }
      } catch (error) {
        setIsAuthenticated(false);
        setUserProfile(null);
        setAuthData(null);
        setAuthError('Authentication check failed. Please try again.');
        
        // Clear any corrupted auth data
        authService.clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    // Only check auth once when component mounts
    checkAuth();
  }, []); // IMPORTANT: Empty dependency array to prevent loops

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      
      // Use auth service to handle logout
      await authService.logout();
      
      // Update local state
      setAuthData(null);
      setIsAuthenticated(false);
      setUserProfile(null);
      setAuthError(null);
      
      navigate('/');
    } catch (error) {
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

  const handleAuthComplete = (userData: any) => {
    // Store auth data using auth service
    authService.setStoredAuth(userData);
    
    // Update local state
    setAuthData(userData);
    setIsAuthenticated(true);
    setUserProfile(userData.user || userData);
    setAuthError(null);
  };

  const handleAuthError = (error: string) => {
    // Clear auth data and update state
    authService.clearAuth();
    setIsAuthenticated(false);
    setAuthData(null);
    setUserProfile(null);
    setAuthError(error);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm sm:text-base">
            {isAuthenticated ? 'Loading dashboard...' : 'Checking authentication...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (authError && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Authentication Error
                </h3>
                <div className="mt-2 text-sm text-red-700">
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

  // If authenticated, render the FacebookLogin component but skip the login flow
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* Header with beta notice and logout */}
        {userProfile && (
          <div className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

              {/* Mobile: stacked layout */}
              <div className="sm:hidden py-3">
                <div className="flex flex-col text-center space-y-2">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
                    <span className="text-sm text-yellow-800 font-medium">
                      AdsMCP is currently in beta — expect ongoing updates and improvements.
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>

              {/* Desktop: notice centered, logout positioned absolute right */}
              <div className="hidden sm:flex sm:items-center sm:justify-center sm:relative py-3">
                {/* Beta notice (centered) */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
                  <span className="text-sm text-yellow-800 font-medium">
                    AdsMCP is currently in beta — expect ongoing updates and improvements.
                  </span>
                </div>

                {/* Logout button (positioned to the right) */}
                <button
                  onClick={handleLogout}
                  className="absolute right-0 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Logout
                </button>
              </div>

            </div>
          </div>
        )}

        <FacebookLogin 
          onServerSelected={onServerSelected} 
          initialAuthData={authData}
          onAuthComplete={handleAuthComplete}
          onAuthError={handleAuthError}
          skipLogin={true}
          authData={authData}
          userProfile={userProfile}
        />
      </div>
    );
  }

  // Show FacebookLogin if not authenticated
  return (
    <FacebookLogin 
      onServerSelected={onServerSelected} 
      initialAuthData={null}
      onAuthComplete={handleAuthComplete}
      onAuthError={handleAuthError}
      skipLogin={false}
    />
  );
};

export default Dashboard;
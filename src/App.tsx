import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import APISection from './components/APISection';
import Stats from './components/Stats';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import AdTools from './components/AdTools';
import Dashboard from './components/Dashboard';
import Spinner from './components/Spinner';
import authService from './auth/authService';

// Landing page component that uses proper navigation
const LandingPage = () => {
  const navigate = useNavigate();
  
  const handleGetStarted = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header onGetStarted={handleGetStarted} />
      <Hero onGetStarted={handleGetStarted} />
      <Features />
      <APISection />
      <Stats />
      <Pricing />
      <Footer />
    </div>
  );
};

// Auth callback component for OAuth redirects
const AuthCallback = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase automatically handles the OAuth callback
        // Just redirect to dashboard and let it handle the session
        navigate('/dashboard');
      } catch {
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center">
          <Spinner size="md" className="mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Processing authentication...</p>
        </div>
      </div>
    );
  }

  return null;
};

const WORKSPACE_STORAGE_KEY = 'meta_ads_workspace';

// Main app wrapper component
const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Updated state to handle all required parameters
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string>('');
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [serverId, setServerId] = useState<string>('');
  const [serverAccessToken, setServerAccessToken] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [hasTriedRestore, setHasTriedRestore] = useState(false);

  const hasWorkspaceState = Boolean(
    selectedBusinessId && selectedAdAccountId && selectedPageId && serverId && serverAccessToken
  );

  // Restore workspace from sessionStorage when refreshing on /workspace
  useEffect(() => {
    if (location.pathname !== '/workspace') {
      setHasTriedRestore(false);
      return;
    }
    if (hasWorkspaceState) {
      setHasTriedRestore(true);
      return;
    }
    if (hasTriedRestore) return;

    const raw = sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw) as {
          businessId?: string;
          adAccountId?: string;
          pageId?: string;
          serverId?: string;
          serverAccessToken?: string;
          userId?: string;
        };
        if (
          data.businessId &&
          data.adAccountId &&
          data.pageId &&
          data.serverId &&
          data.serverAccessToken
        ) {
          setSelectedBusinessId(data.businessId);
          setSelectedAdAccountId(data.adAccountId);
          setSelectedPageId(data.pageId);
          setServerId(data.serverId);
          setServerAccessToken(data.serverAccessToken);
          setUserId(data.userId || '');
        }
      } catch {
        // Invalid or corrupted data, will redirect to dashboard below
      }
    }
    setHasTriedRestore(true);
  }, [location.pathname, hasTriedRestore, hasWorkspaceState]);

  // Updated handler to accept all required parameters
  const handleBusinessSelected = (
    serverIdParam: string,
    businessId: string,
    adAccountId: string,
    pageId: string,
    serverAccessTokenParam: string,
    userIdParam?: string
  ) => {
    if (!serverIdParam || !businessId || !adAccountId || !pageId || !serverAccessTokenParam) {
      return;
    }

    sessionStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        businessId,
        adAccountId,
        pageId,
        serverId: serverIdParam,
        serverAccessToken: serverAccessTokenParam,
        userId: userIdParam || '',
      })
    );

    setSelectedBusinessId(businessId);
    setSelectedAdAccountId(adAccountId);
    setSelectedPageId(pageId);
    setServerId(serverIdParam);
    setServerAccessToken(serverAccessTokenParam);
    setUserId(userIdParam || '');

    navigate('/workspace');
  };

  const handleLogout = () => {
    sessionStorage.removeItem(WORKSPACE_STORAGE_KEY);
    setSelectedBusinessId('');
    setSelectedAdAccountId('');
    setSelectedPageId('');
    setServerId('');
    setServerAccessToken('');
    setUserId('');
    navigate('/');
  };

  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Dashboard routes - step-based URLs: /dashboard, /dashboard/server, /dashboard/business, /dashboard/adaccount, /dashboard/page */}
      <Route 
        path="/dashboard/*" 
        element={
          <Dashboard onServerSelected={handleBusinessSelected} onLogout={handleLogout} />
        } 
      />
      
      {/* Workspace route - Ad Tools */}
      <Route 
        path="/workspace" 
        element={
          hasWorkspaceState ? (
            <AdTools
              businessId={selectedBusinessId}
              adAccountId={selectedAdAccountId}
              pageId={selectedPageId}
              serverId={serverId}
              serverAccessToken={serverAccessToken}
              userId={userId}
            />
          ) : !hasTriedRestore ? (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
              <div className="text-center">
                <Spinner size="md" className="mx-auto" />
                <p className="mt-4 text-gray-600 dark:text-gray-300">Loading workspace...</p>
              </div>
            </div>
          ) : (
            <Navigate to="/dashboard/server" replace />
          )
        } 
      />
      
      {/* Auth callback route for OAuth */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Legacy routes - redirect to new structure */}
      <Route 
        path="/login" 
        element={<Navigate to="/dashboard/server" replace />} 
      />
      <Route 
        path="/auth" 
        element={<Navigate to="/dashboard/server" replace />} 
      />
      <Route 
        path="/tools" 
        element={<Navigate to="/workspace" replace />} 
      />
      
      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
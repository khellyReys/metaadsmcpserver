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
import Dashboard from './components/Dashboard'; // Import the standalone Dashboard component
import authService from './auth/authService';

// Landing page component that uses proper navigation
const LandingPage = () => {
  const navigate = useNavigate();
  
  const handleGetStarted = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white">
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
      } catch (error) {
        navigate('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing authentication...</p>
        </div>
      </div>
    );
  }

  return null;
};

// Main app wrapper component
const AppContent = () => {
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [mcpSecret, setMcpSecret] = useState<string>('');
  const [authData, setAuthData] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Debug: Log current location
  useEffect(() => {
  }, [location]);

  const handleBusinessSelected = (serverId: string, businessId: string, serverData?: any) => {
    setSelectedBusinessId(businessId);
    setMcpSecret(serverId);
    setAuthData(serverData);
    navigate('/workspace');
  };

  const handleLogout = () => {
    
    // Use auth service to logout
    authService.logout();
    
    // Clear business selection state
    setSelectedBusinessId('');
    setMcpSecret('');
    setAuthData(null);
    
    navigate('/');
  };

  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<LandingPage />} />
      
      {/* Dashboard route - Server Management */}
      <Route 
        path="/dashboard" 
        element={
          <Dashboard
            onServerSelected={handleBusinessSelected}
            authData={authData}
            setAuthData={setAuthData}
          />
        } 
      />
      
      {/* Workspace route - Ad Tools */}
      <Route 
        path="/workspace" 
        element={
          selectedBusinessId ? (
            <AdTools
              businessId={selectedBusinessId}
              secret={mcpSecret}
              mcpServerLink={import.meta.env.VITE_MCP_SERVER_URL || "https://localhost:3000"}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        } 
      />
      
      {/* Auth callback route for OAuth */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      {/* Legacy routes - redirect to new structure */}
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
      <Route path="/tools" element={<Navigate to="/workspace" replace />} />
      
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
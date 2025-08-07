import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import APISection from './components/APISection';
import Stats from './components/Stats';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import FacebookLogin from './components/FacebookLogin'; // This now references your refactored component
import OAuthCallback from './components/OAuthCallback';
import AdTools from './components/AdTools';

// Landing page component that uses proper navigation
const LandingPage = () => {
  const navigate = useNavigate();
  
  const handleGetStarted = () => {
    navigate('/login');
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

// Main app wrapper component
const AppContent = () => {
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [mcpSecret, setMcpSecret] = useState<string>('');
  const [authData, setAuthData] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Debug: Log current location
  useEffect(() => {
    console.log('Current route:', location.pathname);
  }, [location]);

  const handleBusinessSelected = (serverId: string, businessId: string, serverData?: any) => {
    // Updated to match your new component's interface
    setSelectedBusinessId(businessId);
    setMcpSecret(serverId); // Using serverId as the secret/identifier
    setAuthData(serverData);
    navigate('/tools');
  };

  const handleAuthComplete = (userData: any) => {
    console.log('Auth completed with user data:', userData);
    setAuthData(userData);
    navigate('/login');
  };

  const handleAuthError = (error: string) => {
    console.error('Auth error:', error);
    setAuthData(null);
    navigate('/');
  };

  return (
    <Routes>
      {/* Landing page */}
      <Route path="/" element={<LandingPage />} />
      
      {/* OAuth callback route */}
      <Route 
        path="/auth/callback" 
        element={
          <OAuthCallback 
            onAuthComplete={handleAuthComplete}
            onError={handleAuthError}
          />
        } 
      />
      
      {/* Login route */}
      <Route 
        path="/login" 
        element={
          <FacebookLogin 
            onServerSelected={handleBusinessSelected} 
            initialAuthData={authData}
          />
        } 
      />
      
      {/* Tools route */}
      <Route 
        path="/tools" 
        element={
          selectedBusinessId ? (
            <AdTools
              businessId={selectedBusinessId}
              secret={mcpSecret}
              mcpServerLink={import.meta.env.VITE_MCP_SERVER_URL || "https://localhost:3000"}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        } 
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
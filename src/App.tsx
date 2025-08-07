import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import APISection from './components/APISection';
import Stats from './components/Stats';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import FacebookLogin from './components/FacebookLogin';
import OAuthCallback from './components/OAuthCallback';
import AdTools from './components/AdTools';

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'tools'>('landing');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [mcpSecret, setMcpSecret] = useState<string>('');
  const [authData, setAuthData] = useState<any>(null);

  const handleGetStarted = () => {
    setCurrentView('login');
  };

  const handleBusinessSelected = (businessId: string, secret: string, serverData?: any) => {
    setSelectedBusinessId(businessId);
    setMcpSecret(secret);
    setAuthData(serverData);
    setCurrentView('tools');
  };

  const handleAuthComplete = (userData: any) => {
    console.log('Auth completed with user data:', userData);
    setAuthData(userData);
    // Redirect to login component to continue the flow
    setCurrentView('login');
  };

  const handleAuthError = (error: string) => {
    console.error('Auth error:', error);
    // Redirect back to landing page on error
    setCurrentView('landing');
  };

  const LandingPage = () => (
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

  return (
    <Router>
      <Routes>
        {/* Main landing page */}
        <Route 
          path="/" 
          element={
            currentView === 'landing' ? (
              <LandingPage />
            ) : currentView === 'login' ? (
              <FacebookLogin 
                onServerSelected={handleBusinessSelected} 
                initialAuthData={authData}
              />
            ) : (
              <AdTools
                businessId={selectedBusinessId}
                secret={mcpSecret}
                mcpServerLink="https://metaadsmcpserver.onrender.com"
              />
            )
          } 
        />
        
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
                mcpServerLink="https://metaadsmcpserver.onrender.com"
              />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
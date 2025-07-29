import React, { useState } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Features from './components/Features';
import APISection from './components/APISection';
import Stats from './components/Stats';
import Pricing from './components/Pricing';
import Footer from './components/Footer';
import FacebookLogin from './components/FacebookLogin';
import AdTools from './components/AdTools';

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'tools'>('landing');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [mcpSecret, setMcpSecret] = useState<string>('');

  const handleGetStarted = () => {
    setCurrentView('login');
  };

  const handleBusinessSelected = (businessId: string, secret: string) => {
    setSelectedBusinessId(businessId);
    setMcpSecret(secret);
    setCurrentView('tools');
  };

  if (currentView === 'login') {
    return <FacebookLogin onBusinessSelected={handleBusinessSelected} />;
  }

  if (currentView === 'tools') {
    return (
      <AdTools
        businessId={selectedBusinessId}
        secret={mcpSecret}
        mcpServerLink="http://localhost:3001"  // ← Your MCP server URL
      />
    );
  }

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
}

export default App;

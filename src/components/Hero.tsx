import React from 'react';
import { ArrowRight, Zap, Globe, Activity } from 'lucide-react';

interface HeroProps {
  onGetStarted?: () => void;
}

const Hero: React.FC<HeroProps> = ({ onGetStarted }) => {
  return (
    <section className="pt-24 pb-12 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full px-4 py-2 mb-8">
            <Activity className="w-4 h-4 text-green-500 mr-2" />
            <span className="text-sm font-medium text-gray-700">MCP Server • Real-time Streaming</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 bg-clip-text text-transparent">
              AI-Powered Facebook Ads
            </span>
            <br />
            <span className="text-gray-900">Automation Platform</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Streamable HTTP MCP server with Server-Sent Events for real-time AI-driven Facebook ad creation, optimization, and management.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button 
              onClick={onGetStarted}
              className="group bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:shadow-xl transition-all duration-300 flex items-center justify-center"
            >
              Start Building
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="bg-white text-gray-700 px-8 py-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200">
              View Documentation
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
              <Zap className="w-8 h-8 text-yellow-500 mb-3 mx-auto" />
              <h3 className="font-semibold text-gray-900 mb-2">Real-time Streaming</h3>
              <p className="text-gray-600 text-sm">SSE-powered live updates</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
              <Globe className="w-8 h-8 text-blue-500 mb-3 mx-auto" />
              <h3 className="font-semibold text-gray-900 mb-2">HTTP MCP Protocol</h3>
              <p className="text-gray-600 text-sm">Standard-compliant interface</p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-gray-200">
              <Activity className="w-8 h-8 text-green-500 mb-3 mx-auto" />
              <h3 className="font-semibold text-gray-900 mb-2">AI Automation</h3>
              <p className="text-gray-600 text-sm">Intelligent ad optimization</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
import React from 'react';
import { Code, Terminal, Wifi } from 'lucide-react';

const APISection = () => {
  return (
    <section id="api" className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Developer-First
            <span className="bg-gradient-to-r from-blue-600 to-teal-600 bg-clip-text text-transparent"> API Design</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            RESTful API with real-time streaming capabilities built for modern development workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Code className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">RESTful Endpoints</h3>
                  <p className="text-gray-600">Clean, intuitive API design following REST principles with comprehensive OpenAPI documentation.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Server-Sent Events</h3>
                  <p className="text-gray-600">Real-time data streaming for live ad performance updates and instant notifications.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">MCP Protocol</h3>
                  <p className="text-gray-600">Standard Model Context Protocol implementation for seamless AI model integration.</p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button className="bg-gradient-to-r from-blue-600 to-teal-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all duration-200">
                Explore API Docs
              </button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 overflow-x-auto">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-400 text-sm ml-4">AdsMCP API</span>
            </div>
            <pre className="text-green-400 text-sm leading-relaxed">
{`// Initialize MCP client
const client = new MCPClient({
  endpoint: 'https://api.adsmcp.com',
  token: 'your-api-token'
});

// Create AI-powered ad campaign
const campaign = await client.campaigns.create({
  name: 'Summer Sale 2024',
  objective: 'conversions',
  budget: 1000,
  aiOptimization: true
});

// Stream real-time performance
const stream = client.performance.stream(campaign.id);
stream.on('update', (data) => {
});`}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
};

export default APISection;
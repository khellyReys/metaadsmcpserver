import React from 'react';
import { Server, Zap, Brain, BarChart3, Shield, Rocket } from 'lucide-react';

const Features = () => {
  const features = [
    {
      icon: Server,
      title: 'MCP Server Architecture',
      description: 'Built on the Model Context Protocol standard for seamless AI integration and extensibility.',
      color: 'blue'
    },
    {
      icon: Zap,
      title: 'Server-Sent Events',
      description: 'Real-time streaming updates for live ad performance monitoring and instant notifications.',
      color: 'yellow'
    },
    {
      icon: Brain,
      title: 'AI-Driven Creation',
      description: 'Intelligent ad copy generation, image selection, and audience targeting powered by advanced AI.',
      color: 'purple'
    },
    {
      icon: BarChart3,
      title: 'Performance Analytics',
      description: 'Comprehensive real-time analytics with predictive insights and optimization recommendations.',
      color: 'green'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-grade security with OAuth2, encrypted data transmission, and compliance certifications.',
      color: 'red'
    },
    {
      icon: Rocket,
      title: 'Scalable Infrastructure',
      description: 'Auto-scaling architecture that handles millions of ad requests with sub-second response times.',
      color: 'teal'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'text-blue-500 bg-blue-50',
      yellow: 'text-yellow-500 bg-yellow-50',
      purple: 'text-purple-500 bg-purple-50',
      green: 'text-green-500 bg-green-50',
      red: 'text-red-500 bg-red-50',
      teal: 'text-teal-500 bg-teal-50'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <section id="features" className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Powerful Features for
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Modern Advertising</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Everything you need to automate and optimize your Facebook advertising campaigns with cutting-edge AI technology.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="group bg-white rounded-2xl p-8 border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl ${getColorClasses(feature.color)} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
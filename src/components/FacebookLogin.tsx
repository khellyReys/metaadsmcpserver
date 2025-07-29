import React, { useState } from 'react';
import { Facebook, ArrowRight, Building2, Users, CheckCircle } from 'lucide-react';

interface BusinessAccount {
  id: string;
  name: string;
  role: string;
  adAccounts: number;
  status: 'active' | 'pending';
}

interface FacebookLoginProps {
  onBusinessSelected: (businessId: string) => void;
}

const FacebookLogin: React.FC<FacebookLoginProps> = ({ onBusinessSelected }) => {
  const [step, setStep] = useState<'login' | 'business-selection'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');

  // Mock business accounts data
  const businessAccounts: BusinessAccount[] = [
    {
      id: 'bm_001',
      name: 'TechCorp Marketing',
      role: 'Admin',
      adAccounts: 12,
      status: 'active'
    },
    {
      id: 'bm_002',
      name: 'E-commerce Solutions Ltd',
      role: 'Advertiser',
      adAccounts: 8,
      status: 'active'
    },
    {
      id: 'bm_003',
      name: 'Digital Agency Pro',
      role: 'Admin',
      adAccounts: 25,
      status: 'active'
    },
    {
      id: 'bm_004',
      name: 'Startup Ventures',
      role: 'Editor',
      adAccounts: 3,
      status: 'pending'
    }
  ];

  const handleFacebookLogin = async () => {
    setIsLoading(true);
    // Simulate Facebook OAuth flow
    setTimeout(() => {
      setIsLoading(false);
      setStep('business-selection');
    }, 2000);
  };

  const handleBusinessSelection = () => {
    if (selectedBusiness) {
      onBusinessSelected(selectedBusiness);
    }
  };

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Facebook className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Facebook Account</h1>
              <p className="text-gray-600">
                Sign in with Facebook to access your Business Manager accounts and start automating your ads.
              </p>
            </div>

            <button
              onClick={handleFacebookLogin}
              disabled={isLoading}
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Facebook className="w-5 h-5" />
                  <span>Continue with Facebook</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                By continuing, you agree to our{' '}
                <a href="#" className="text-blue-600 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Business Manager Account</h1>
          <p className="text-gray-600">Choose the business account you want to manage ads for</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {businessAccounts.map((business) => (
            <div
              key={business.id}
              onClick={() => setSelectedBusiness(business.id)}
              className={`bg-white rounded-xl p-6 border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                selectedBusiness === business.id
                  ? 'border-blue-500 shadow-lg'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{business.name}</h3>
                    <p className="text-sm text-gray-500">{business.role}</p>
                  </div>
                </div>
                {selectedBusiness === business.id && (
                  <CheckCircle className="w-6 h-6 text-blue-500" />
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{business.adAccounts} Ad Accounts</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  business.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {business.status === 'active' ? 'Active' : 'Pending'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={handleBusinessSelection}
            disabled={!selectedBusiness}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
          >
            <span>Continue to Ad Tools</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacebookLogin;
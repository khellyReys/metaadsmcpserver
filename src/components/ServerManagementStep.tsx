import React, { useState } from 'react';
import { ArrowRight, Plus, Server, X, AlertCircle } from 'lucide-react';
import { SupabaseClient } from '@supabase/supabase-js';

interface Server {
  id: string;
  name: string;
  access_token: string;
  created_at: string;
  is_active: boolean;
}

interface ServerManagementStepProps {
  currentUser: any;
  servers: Server[];
  error: string;
  onServerSelected: (serverId: string) => void;
  onServerCreated: (server: Server) => void;
  onLogout: () => void;
  onClearError: () => void;
  supabase: SupabaseClient;
}

const ServerManagementStep: React.FC<ServerManagementStepProps> = ({
  currentUser,
  servers,
  error,
  onServerSelected,
  onServerCreated,
  onLogout,
  onClearError,
  supabase
}) => {
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverName, setServerName] = useState('');
  const [isCreatingServer, setIsCreatingServer] = useState(false);

  const handleCreateServer = async () => {
    if (!serverName.trim() || !currentUser) return;

    setIsCreatingServer(true);
    onClearError();

    try {
      const { data: serverData, error: serverError } = await supabase
        .rpc('create_server_with_session', {
          p_user_id: currentUser.id,
          p_server_name: serverName.trim(),
          p_description: null,
          p_expires_hours: 24 * 30 // 30 days
        });

      if (serverError) {
        throw new Error('Failed to create server: ' + serverError.message);
      }

      if (!serverData || serverData.length === 0) {
        throw new Error('No server data returned');
      }

      const newServerData = serverData[0];
      const newServer: Server = {
        id: newServerData.server_id,
        name: serverName,
        access_token: newServerData.session_token,
        created_at: new Date().toISOString(),
        is_active: true
      };

      onServerCreated(newServer);
      setServerName('');
      setShowServerModal(false);

      console.log('Server created successfully:', {
        serverId: newServerData.server_id,
        sessionToken: newServerData.session_token,
        accessToken: newServerData.access_token
      });

    } catch (err) {
      console.error('Error creating server:', err);
      // Error will be handled by parent component
    } finally {
      setIsCreatingServer(false);
    }
  };

  const handleSelectServer = (serverId: string) => {
    onServerSelected(serverId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          {currentUser && (
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {currentUser.user_metadata?.avatar_url && (
                  <img 
                    src={currentUser.user_metadata.avatar_url} 
                    alt={currentUser.user_metadata?.full_name}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    Welcome, {currentUser.user_metadata?.full_name || currentUser.email}!
                  </p>
                  <p className="text-sm text-gray-600">{currentUser.email}</p>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign Out
              </button>
            </div>
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your MCP Servers</h1>
          <p className="text-gray-600">Create and manage your Facebook ads automation servers</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Servers List */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Your Servers ({servers.length})
            </h2>
            <button
              onClick={() => setShowServerModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Server</span>
            </button>
          </div>

          {servers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Server className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Servers Yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first MCP server to start automating Facebook ads.
              </p>
              <button
                onClick={() => setShowServerModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg inline-flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Server</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg flex items-center justify-center">
                        <Server className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{server.name}</h3>
                        <p className="text-sm text-gray-500">
                          Created {new Date(server.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Active
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-600 font-medium mb-1">Access Token:</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono break-all">
                      {server.access_token.substring(0, 20)}...
                    </code>
                  </div>

                  <button
                    onClick={() => handleSelectServer(server.id)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    <span>Select Server</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Server Creation Modal */}
        {showServerModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Create New Server</h3>
                <button
                  onClick={() => setShowServerModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server Name
                </label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="e.g., Main Ads Server"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowServerModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateServer}
                  disabled={!serverName.trim() || isCreatingServer}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {isCreatingServer ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Server</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerManagementStep;
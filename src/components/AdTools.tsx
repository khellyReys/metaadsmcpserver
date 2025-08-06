import React, { useState, useEffect, useMemo } from "react";
import { Copy, Search, Play, Zap, AlertCircle, CheckCircle2, Loader, X, Settings, Terminal } from "lucide-react";
// @ts-ignore
import { toolPaths } from '../../public/tools/paths.js';

interface McpTool {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters?: {
    type: string;
    properties: Record<string, {
      type: string;
      description?: string;
      required?: boolean;
    }>;
    required?: string[];
  };
}

interface AdToolsProps {
  businessId: string;
  secret: string;
}

const MCP_BASE_URL = import.meta.env.VITE_MCP_URL || "http://localhost:3001";

const AdTools: React.FC<AdToolsProps> = ({ businessId, secret }) => {
  // State hooks...
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [tools, setTools] = useState<McpTool[]>([]);
  const [sessionPath, setSessionPath] = useState<string>();
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [toolResponse, setToolResponse] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Load tools effect
  useEffect(() => {
    async function loadTools() {
      const loaded: McpTool[] = [];
      const seen = new Set<string>();
      for (const path of toolPaths) {
        try {
          const mod = await import(`../../tools/${path}`);
          const def = mod.apiTool?.definition?.function;
          if (def?.name && def?.description && !seen.has(def.name)) {
            seen.add(def.name);
            loaded.push({
              id: `${def.name}:${path}`,
              name: def.name,
              description: def.description,
              category: mod.apiTool.definition.function.category || "Uncategorized",
              parameters: def.parameters || undefined,
            });
          }
        } catch {}
      }
      setTools(loaded);
    }
    loadTools();
  }, []);

  // Filters
  const categories = useMemo(() => ["All", ...Array.from(new Set(tools.map(t => t.category))).sort()], [tools]);
  const filtered = useMemo(() => tools.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === "All" || t.category === selectedCategory;
    return matchesSearch && matchesCat;
  }), [tools, searchTerm, selectedCategory]);

  // SSE URL & handshake
  const sseUrl = useMemo(() => `${MCP_BASE_URL}/sse?token=${btoa(`${businessId}:${secret}`)}`, [businessId, secret]);
  useEffect(() => {
    setConnecting(true);
    setError(null);
    setSessionPath(undefined);
    const es = new EventSource(sseUrl);
    es.addEventListener("endpoint", (e: MessageEvent) => {
      setSessionPath(e.data);
      setConnecting(false);
      es.close();
    });
    es.onerror = () => {
      setError("Failed to connect to SSE.");
      setConnecting(false);
      es.close();
    };
    return () => es.close();
  }, [sseUrl]);

  // Helpers: copy, callTool, open/close dialog, handle params
  const copyToClipboard = (txt: string) => () => navigator.clipboard.writeText(txt);
  const callTool = async (name: string, args: Record<string, any>) => {
    if (!sessionPath) return;
    setRunningTool(name);
    setToolResponse(null);
    setExecutionError(null);
    try {
      const res = await fetch(`${MCP_BASE_URL}${sessionPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: name, params: { arguments: args } }),
      });
      const result = await res.json();
      setToolResponse(result);
    } catch (err) {
      setExecutionError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setRunningTool(null);
    }
  };
  const openToolDialog = (tool: McpTool) => {
    setSelectedTool(tool);
    const initialValues: Record<string,string> = {};
    tool.parameters?.properties && Object.keys(tool.parameters.properties).forEach(key => {
      initialValues[key] = key === 'account_id' ? businessId : '';
    });
    setParameterValues(initialValues);
    setToolResponse(null);
    setExecutionError(null);
  };
  const closeToolDialog = () => { setSelectedTool(null); setParameterValues({}); setToolResponse(null); setExecutionError(null); };
  const handleParameterChange = (k:string, v:string) => setParameterValues(p => ({ ...p, [k]: v }));
  const executeToolWithParams = () => {
    if (!selectedTool) return;
    const processed: Record<string, any> = {};
    Object.entries(parameterValues).forEach(([k,v]) => {
      const def = selectedTool.parameters?.properties[k];
      if (def?.type === 'number') processed[k] = v ? Number(v) : undefined;
      else if (def?.type === 'boolean') processed[k] = v === 'true';
      else processed[k] = v || undefined;
    });
    callTool(selectedTool.name, processed);
  };
  const isFormValid = () => !selectedTool?.parameters || (selectedTool.parameters.required || []).every(r => parameterValues[r]?.trim());
  const status = connecting ? {icon:Loader,text:'Connecting...',color:'text-yellow-600'}
                : error ? {icon:AlertCircle,text:'Connection Failed',color:'text-red-600'}
                : sessionPath ? {icon:CheckCircle2,text:'Connected',color:'text-green-600'}
                : {icon:AlertCircle,text:'Disconnected',color:'text-gray-600'};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-white/30 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
                  MCP Tools Dashboard
                </h1>
                <p className="text-gray-600 text-sm mt-1">Manage and execute your MCP tools</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 font-medium">Business ID:</span>
              <code className="px-3 py-1.5 bg-gray-100 rounded-lg text-gray-700 font-mono text-xs border">{businessId}</code>
              <div className="flex items-center gap-2 ml-6 px-3 py-1.5 bg-white/60 rounded-lg border border-white/40">
                <status.icon className={`w-4 h-4 ${status.color} ${connecting? 'animate-spin':''}`} />
                <span className={`text-sm font-medium ${status.color}`}>{status.text}</span>
              </div>
            </div>
          </div>
          <div className="space-y-3 lg:max-w-md">
            <div className="group relative flex items-center bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
              <input readOnly value={sseUrl} className="flex-1 p-3 text-xs font-mono text-gray-600 bg-transparent" />
              <button onClick={copyToClipboard(sseUrl)} className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white transition-colors">
                <Copy className="w-4 h-4"/>
              </button>
            </div>
            {sessionPath && (
              <div className="group relative flex items-center bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                <input readOnly value={`${MCP_BASE_URL}${sessionPath}`} className="flex-1 p-3 text-xs font-mono text-gray-600 bg-transparent" />
                <button onClick={copyToClipboard(`${MCP_BASE_URL}${sessionPath}`)} className="px-4 py-3 bg-green-500 hover:bg-green-600 text-white transition-colors">
                  <Copy className="w-4 h-4"/>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Modal Portal */}
      {selectedTool && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-gray-900/70 backdrop-blur-sm" onClick={closeToolDialog} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[75vh] overflow-hidden border border-white/20 flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 px-6 py-4 text-white">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Settings className="w-5 h-5"/>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{selectedTool.name}</h2>
                    <p className="text-blue-100 text-xs mt-1 opacity-90 max-w-sm">{selectedTool.description}</p>
                    <div className="mt-2">
                      <span className="inline-block px-2 py-1 bg-white/20 rounded-full text-xs font-medium">
                        {selectedTool.category}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={closeToolDialog} 
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5"/>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Parameters Section */}
              <div className="p-6">
                {selectedTool.parameters?.properties ? (
                  <>
                    <div className="flex items-center gap-3 text-sm text-blue-700 bg-blue-50 px-4 py-3 rounded-xl border border-blue-200 mb-6">
                      <AlertCircle className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Configure the parameters below to execute this tool</span>
                    </div>
                    <div className="grid gap-4">
                      {Object.entries(selectedTool.parameters.properties).map(([k,def]) => {
                        const required = selectedTool.parameters?.required?.includes(k);
                        return (
                          <div key={k} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                                {k}
                                {required && <span className="text-red-500 text-xs">*</span>}
                              </label>
                              <span className="text-xs font-mono px-2 py-1 bg-gray-100 rounded text-gray-600">
                                {def.type}
                              </span>
                            </div>
                            {def.description && (
                              <p className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border-l-2 border-blue-200">
                                {def.description}
                              </p>
                            )}
                            {def.type === 'boolean' ? (
                              <select 
                                value={parameterValues[k]||'false'} 
                                onChange={e=>handleParameterChange(k,e.target.value)} 
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                              >
                                <option value="false">False</option>
                                <option value="true">True</option>
                              </select>
                            ) : (
                              <input 
                                type={def.type==='number'?'number':'text'} 
                                value={parameterValues[k]||''} 
                                onChange={e=>handleParameterChange(k,e.target.value)} 
                                placeholder={`Enter ${k}...`} 
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm" 
                                required={required} 
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="p-3 bg-blue-50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <Settings className="w-8 h-8 text-blue-600"/>
                    </div>
                    <p className="text-gray-700 font-medium">No parameters required</p>
                    <p className="text-gray-500 text-sm mt-1">This tool can be executed directly</p>
                  </div>
                )}
              </div>

              {/* Execution Logs Section */}
              {(toolResponse || executionError) && (
                <div className="border-t border-gray-200 bg-gray-50">
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-gray-700 rounded-lg">
                        <Terminal className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800 text-sm">Execution Log</h3>
                        <p className="text-xs text-gray-600">Tool execution results and responses</p>
                      </div>
                      <div className={`ml-auto w-2.5 h-2.5 rounded-full ${executionError ? 'bg-red-500' : 'bg-green-500'}`} />
                    </div>
                    
                    <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-60">
                      {executionError ? (
                        <div>
                          <div className="text-red-400 text-xs font-medium mb-2">❌ Execution Error</div>
                          <pre className="text-red-300 text-xs font-mono whitespace-pre-wrap">{executionError}</pre>
                        </div>
                      ) : (
                        <div>
                          <div className="text-green-400 text-xs font-medium mb-2">✅ Success</div>
                          <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">
                            {JSON.stringify(toolResponse, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 flex justify-between items-center border-t border-gray-200">
              <div className="text-xs text-gray-600">
                {selectedTool.parameters?.required && selectedTool.parameters.required.length > 0 && (
                  <span>* Required fields</span>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={closeToolDialog} 
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Close
                </button>
                <button 
                  onClick={executeToolWithParams} 
                  disabled={!isFormValid() || runningTool === selectedTool.name} 
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-indigo-700 transition-all font-medium flex items-center gap-2 text-sm"
                >
                  {runningTool === selectedTool.name ? (
                    <>
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Execute Tool
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search tools by name or description..." 
              value={searchTerm} 
              onChange={e=>setSearchTerm(e.target.value)} 
              className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm" 
            />
          </div>
          <div className="flex gap-2 overflow-auto pb-2">
            {categories.map(cat=>(
              <button 
                key={cat} 
                onClick={()=>setSelectedCategory(cat)} 
                className={`px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                  selectedCategory===cat
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                    : 'bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-white hover:shadow-md text-gray-700'
                }`}
              > 
                {cat} 
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            {error}
          </div>
        )}

        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(tool=>(
            <div 
              key={`${tool.name}:${tool.id}`} 
              className="group p-6 bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-2xl hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-300/60 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl group-hover:from-blue-200 group-hover:to-indigo-200 transition-colors">
                  <Settings className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full font-medium">
                  {tool.category}
                </span>
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {tool.name}
              </h3>
              <p className="text-sm text-gray-600 mb-6 line-clamp-3 leading-relaxed">
                {tool.description}
              </p>
              <button 
                onClick={()=>openToolDialog(tool)} 
                disabled={!sessionPath} 
                className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Configure & Run
              </button>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filtered.length === 0 && !connecting && (
          <div className="text-center py-16">
            <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Search className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg">No tools found matching your search</p>
            <p className="text-gray-400 text-sm mt-2">Try adjusting your search terms or category filter</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdTools;
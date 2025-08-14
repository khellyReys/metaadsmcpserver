import React, { useState, useEffect, useMemo, useRef  } from "react";
import { Copy, Search, Play, ArrowLeft, AlertCircle, CheckCircle2, Loader, X, Settings, Terminal } from "lucide-react";
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
  accountId: string;
  secret: string;
  serverId: string;
  serverAccessToken: string;
}

const MCP_BASE_URL = import.meta.env.VITE_MCP_URL || "https://metaadsmcpserver.onrender.com";

const AdTools: React.FC<AdToolsProps> = ({ accountId, secret, serverId, serverAccessToken  }) => {
  // State hooks...
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [sessionPath, setSessionPath] = useState<string>();
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [toolResponse, setToolResponse] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const pendingRef = useRef<Map<number, (msg: any) => void>>(new Map());

  // Load tools effect
  useEffect(() => {
    async function loadTools() {
      setLoadingTools(true);
      const loaded: McpTool[] = [];
      const seen = new Set<string>();
      
      try {
        for (const path of toolPaths) {
          try {
            const mod = await import(`../../tools/${path}`);
            const def = mod.apiTool?.definition?.function;
            if (def?.name && def?.description && !seen.has(def.name)) {
              seen.add(def.name);
              
              // STEP 3: Smart Category Detection
              let category = 'General'; // Default fallback
              const name = def.name.toLowerCase(); // Convert to lowercase for easier matching
              
              // STEP 4: Pattern Matching Logic
              // Check for specific keywords in the tool name
              if (name.includes('campaign')) {
                category = 'Campaigns';
              } else if (name.includes('adset')) {
                category = 'Ad Sets';
              } else if (name.includes('ad') && !name.includes('campaign')) {
                // This catches "ad" but excludes "campaign" to avoid double-matching
                category = 'Ads';
              } else if (name.includes('conversion') || name.includes('attribution')) {
                category = 'Analytics';
              } else if (name.includes('report') || name.includes('insight')) {
                category = 'Reporting';
              } else if (name.includes('creative') || name.includes('image')) {
                category = 'Creative';
              } else if (name.includes('audience') || name.includes('targeting')) {
                category = 'Targeting';
              } else if (name.includes('bid') || name.includes('budget')) {
                category = 'Optimization';
              }
              
              loaded.push({
                id: `${def.name}:${path}`,
                name: def.name,
                description: def.description,
                // STEP 5: Priority System
                // 1. Use explicit category from tool file (if exists)
                // 2. Use our auto-detected category
                category: mod.apiTool.definition.function.category || category,
                parameters: def.parameters || undefined,
              });
            }
          } catch {}
        }
      } catch (error) {
        console.error('Error loading tools:', error);
      } finally {
        setTools(loaded);
        setLoadingTools(false);
      }
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

  // SSE URL & handshake - FIXED: using accountId instead of businessId
  const sseUrl = useMemo(() => {
    const tokenString = `${serverId}:${serverAccessToken}`;
    const encodedToken = btoa(tokenString);
    return `${MCP_BASE_URL}/api/sse?token=${encodeURIComponent(encodedToken)}`;
  }, [serverId, serverAccessToken]);
  
  useEffect(() => {
    esRef.current?.close();
    setConnecting(true);
    setError(null);
    setSessionPath(undefined);

    const es = new EventSource(sseUrl);
    esRef.current = es;
  
    const onEndpoint = (e: MessageEvent) => {
      // e.data like "/messages?sessionId=..."
      setSessionPath(e.data as string);
      setConnecting(false);
    };
  
    const onMessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg && typeof (msg as any).id !== "undefined") {
          const fn = pendingRef.current.get((msg as any).id);
          if (fn) {
            pendingRef.current.delete((msg as any).id);
            fn(msg);
          }
        }
      } catch {
        // ignore non-JSON/keepalive lines
      }
    };
  
    es.addEventListener("endpoint", onEndpoint);
    es.addEventListener("message", onMessage);
  
    es.onopen = () => {
      setConnecting(false);
      setError(null);
    };
  
    es.onerror = () => {
      setError("SSE disconnected. Reconnecting…");
      setConnecting(true);
    };
  
    return () => {
      es.removeEventListener("endpoint", onEndpoint);
      es.removeEventListener("message", onMessage);
      es.close();
      esRef.current = null;
    };
  }, [sseUrl]);
  


  // Helpers: copy, callTool, open/close dialog, handle params
  const copyToClipboard = (txt: string) => async () => {
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  const postRpc = async (body: any) => {
    const doPost = async (path: string) => {
      const res = await fetch(`${MCP_BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
  
      // 202 Accepted => response will arrive via SSE, not this HTTP response
      if (res.status === 202) {
        return { status: "accepted" };
      }
  
      // 200 OK with JSON (some servers may do this)
      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) return res.json();
        const raw = await res.text().catch(() => "");
        if (!raw || raw.toLowerCase().includes("accepted")) {
          return { status: "accepted" };
        }
        // Unexpected non-JSON success body
        return { status: "ok", raw };
      }
  
      // Try to read and parse any error body
      const raw = await res.text().catch(() => "");
      let j: any = null;
      try { j = raw ? JSON.parse(raw) : null; } catch {}
  
      // A) Dead session -> server suggests a live one
      if (res.status === 400 && j?.availableSessions?.length) {
        const fresh = `/messages?sessionId=${j.availableSessions[0]}`;
        setSessionPath(fresh);
        const retry = await fetch(`${MCP_BASE_URL}${fresh}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (retry.status === 202) return { status: "accepted" };
        if (retry.ok) return retry.json();
  
        const retryRaw = await retry.text().catch(() => "");
        let retryJson: any = null;
        try { retryJson = retryRaw ? JSON.parse(retryRaw) : null; } catch {}
        const retryMsg = retryJson?.error?.message || retryRaw || `status ${retry.status}`;
        throw new Error(`Retry failed: ${retryMsg}`);
      }
  
      // B) Proper MCP error payload
      if (j?.error?.message) {
        const code = j?.error?.code != null ? ` (code ${j.error.code})` : "";
        throw new Error(`${j.error.message}${code}`);
      }
  
      // Fallback: include raw body for debugging
      throw new Error(`RPC failed: ${res.status}${raw ? ` - ${raw}` : ""}`);
    };
  
    if (!sessionPath) throw new Error("No session");
    return doPost(sessionPath);
  };
  
  const callTool = async (name: string, args: Record<string, any>) => {
    if (!sessionPath) return;
    setRunningTool(name);
    setToolResponse(null);
    setExecutionError(null);
  
    // unique id for this JSON-RPC call
    const id = Date.now();
  
    // Promise that resolves when SSE delivers the response with matching id
    const waitForSse = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRef.current.delete(id);
        reject(new Error("Timed out waiting for tool response"));
      }, 30000); // adjust if your tools take longer
  
      pendingRef.current.set(id, (msg) => {
        clearTimeout(timeout);
        resolve(msg);
      });
    });
  
    try {
  
      const postResult = await postRpc({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { name, arguments: args },
      });
  
      // If HTTP returned 202 Accepted, the real result will arrive via SSE
      if (postResult && postResult.status === "accepted") {
        const sseMsg = await waitForSse;
        if (sseMsg?.error) {
          throw new Error(sseMsg.error?.message || "Tool execution failed");
        }
        setToolResponse(sseMsg);
      } else {
        // Some servers may return JSON directly
        setToolResponse(postResult);
        pendingRef.current.delete(id); // avoid leak if SSE also sends something
      }
    } catch (err) {
      pendingRef.current.delete(id);
      setExecutionError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setRunningTool(null);
    }
  };
  
  
  
  const openToolDialog = (tool: McpTool) => {
    setSelectedTool(tool);
    const initialValues: Record<string,string> = {};
    tool.parameters?.properties && Object.keys(tool.parameters.properties).forEach(key => {
      initialValues[key] = key === 'account_id' ? accountId : '';
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
    const props = selectedTool.parameters?.properties || {};
    const required = new Set(selectedTool.parameters?.required || []);
  
    Object.entries(props).forEach(([k, def]) => {
      const raw = (parameterValues[k] ?? "").toString();
  
      if (def.type === "number") {
        // keep the key; empty -> null, otherwise Number
        processed[k] = raw.trim() === "" ? null : Number(raw);
      } else if (def.type === "boolean") {
        // always present; default false if empty
        processed[k] = raw === "true";
      } else {
        // strings/other: keep empty string if user left it blank
        processed[k] = raw;
      }
  
      // Optional: trim strings if not required
      if (typeof processed[k] === "string" && !required.has(k)) {
        processed[k] = processed[k].trim();
      }
    });
  
    callTool(selectedTool.name, processed);
  };
  
  const isFormValid = () => !selectedTool?.parameters || (selectedTool.parameters.required || []).every(r => parameterValues[r]?.trim());
  
  const handleBackToServers = () => {
    // Navigate back to MCP Servers page
    window.history.back(); // or use your router's navigation method
  };
  const status = connecting ? {icon:Loader,text:'Connecting...',color:'text-yellow-600'}
                : error ? {icon:AlertCircle,text:'Connection Failed',color:'text-red-600'}
                : sessionPath ? {icon:CheckCircle2,text:'Connected',color:'text-green-600'}
                : {icon:AlertCircle,text:'Disconnected',color:'text-gray-600'};

const StatusIcon = status.icon;

const getReadableOutput = (resp: any) => {
  if (!resp) return "";

  // SSE-delivered MCP result shape: { jsonrpc, id, result: { content: [{ type:"text", text:"..." }] } }
  const sseText = resp?.result?.content?.find?.((c: any) => c?.type === "text")?.text;
  if (typeof sseText === "string") return sseText;

  // Direct JSON (non-SSE) fallback: sometimes servers return { content:[{type,text}] }
  const directText = resp?.content?.find?.((c: any) => c?.type === "text")?.text;
  if (typeof directText === "string") return directText;

  // Nothing text-like? show JSON
  try {
    return JSON.stringify(resp, null, 2);
  } catch {
    return String(resp);
  }
};

  // Loading Progress Component
  const LoadingProgress = () => (
    <div className="flex flex-col items-center justify-center py-12 sm:py-20">
      <div className="relative w-20 h-20 mb-6">
        <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        <div className="absolute inset-4 bg-blue-50 rounded-full flex items-center justify-center">
          <Settings className="w-6 h-6 text-blue-600 animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Loading Available Tools</h3>
        <p className="text-gray-600 text-sm sm:text-base max-w-md px-4">
          Discovering and configuring tools for your Meta Ads account...
        </p>
      </div>
      <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
      </div>
    </div>
  );



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="space-y-4">
            {/* Title and Back Button Row */}
            <div className="flex items-center gap-3">
              <button 
                onClick={handleBackToServers}
                className="p-2 sm:p-2.5 bg-gradient-to-r from-blue-600 to-purple-700 rounded-xl hover:from-blue-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-purple-700 bg-clip-text text-transparent truncate">
                  Available Tools
                </h1>
              </div>
            </div>

            {/* Connection Info - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm">
              {/* Server Link - Collapsible on mobile */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl min-w-0">
                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                <span className="text-gray-700 whitespace-nowrap">MCP Server:</span>
                <div className="min-w-0 flex-1 max-w-xs sm:max-w-md">
                  <div className="flex items-center border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white hover:border-gray-300 transition-colors">
                    <input 
                      readOnly 
                      value={sseUrl} 
                      className="flex-1 p-2 text-xs font-mono text-gray-600 bg-gray-50 min-w-0" 
                    />
                    <button 
                      onClick={copyToClipboard(sseUrl)} 
                      className={`px-3 py-2 transition-all text-white flex-shrink-0 ${
                        copied 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800'
                      }`}
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-full w-fit">
                <StatusIcon className={`w-4 h-4 ${status.color} ${connecting ? 'animate-spin' : ''} flex-shrink-0`} />
                <span className={`text-sm font-semibold ${status.color} whitespace-nowrap`}>{status.text}</span>
              </div>
            </div>

            {/* Search Bar - Full width on mobile */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search tools..." 
                value={searchTerm} 
                onChange={e=>setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium shadow-sm" 
                disabled={loadingTools}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Modal Portal - Mobile Optimized */}
      {selectedTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black bg-opacity-60" onClick={closeToolDialog} />
          <div className="relative bg-white rounded-xl sm:rounded-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl m-2 sm:mx-4">
            {/* Modal Header - Mobile Optimized */}
            <div className="bg-blue-600 px-4 sm:px-6 py-3 sm:py-4 text-white">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Settings className="w-5 h-5 sm:w-6 sm:h-6"/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-bold truncate">{selectedTool.name}</h2>
                    <p className="text-blue-100 text-sm mt-1 line-clamp-2">{selectedTool.description}</p>
                    <span className="inline-block px-2 sm:px-3 py-1 bg-white/20 rounded-full text-xs font-medium mt-2">
                      {selectedTool.category}
                    </span>
                  </div>
                </div>
                <button onClick={closeToolDialog} className="p-2 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0">
                  <X className="w-5 h-5 sm:w-6 sm:h-6"/>
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Parameters Section */}
              <div className="p-4 sm:p-6">
                {selectedTool.parameters?.properties ? (
                  <>
                    <div className="flex items-start gap-3 text-sm text-blue-800 bg-blue-50 px-3 sm:px-4 py-3 rounded-xl mb-4 sm:mb-6 border border-blue-200">
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <span className="font-medium">Configure the parameters below to execute this tool</span>
                    </div>
                    <div className="space-y-4 sm:space-y-6">
                      {Object.entries(selectedTool.parameters.properties).map(([k,def]) => {
                        const required = selectedTool.parameters?.required?.includes(k);
                        return (
                          <div key={k}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                              <label className="font-semibold text-gray-900 text-sm">
                                {k} {required && <span className="text-red-500 ml-1">*</span>}
                              </label>
                              <span className="text-xs bg-gray-100 px-3 py-1 rounded-full text-gray-700 font-medium w-fit">
                                {def.type}
                              </span>
                            </div>
                            {def.description && (
                              <p className="text-sm text-gray-600 mb-3 bg-gray-50 px-3 sm:px-4 py-2 rounded-lg">
                                {def.description}
                              </p>
                            )}
                            {def.type === 'boolean' ? (
                              <select 
                                value={parameterValues[k]||'false'} 
                                onChange={e=>handleParameterChange(k,e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-base"
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
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-base" 
                                required={required} 
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Settings className="w-8 h-8 text-gray-400"/>
                    </div>
                    <p className="text-gray-800 font-semibold text-lg">No parameters required</p>
                    <p className="text-gray-500 text-sm mt-2">This tool can be executed directly</p>
                  </div>
                )}
              </div>

              {/* Execution Logs Section */}
              {(toolResponse || executionError) && (
                <div className="border-t bg-gray-50">
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                        <Terminal className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Execution Log</h3>
                      <div className={`ml-auto w-3 h-3 rounded-full ${executionError ? 'bg-red-500' : 'bg-green-500'} shadow-sm`} />
                    </div>
                    
                    <div className="bg-gray-900 rounded-xl p-3 sm:p-5 overflow-auto max-h-40 sm:max-h-60 shadow-inner">
                      {executionError ? (
                        <div>
                          <div className="text-red-400 text-sm mb-3 font-medium">❌ Execution Error</div>
                          <pre className="text-red-300 text-xs sm:text-sm whitespace-pre-wrap break-words">{executionError}</pre>
                        </div>
                      ) : (
                        <div>
                          <div className="text-green-400 text-sm mb-3 font-medium">✅ Success</div>
                          <pre className="text-gray-300 text-xs sm:text-sm whitespace-pre-wrap break-words">
                            {getReadableOutput(toolResponse)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - Mobile Optimized */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 bg-gray-50 border-t flex-shrink-0">
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
                <div className="text-sm text-gray-600 order-2 sm:order-1">
                  {selectedTool.parameters?.required && selectedTool.parameters.required.length > 0 && (
                    <span className="font-medium">* Required fields</span>
                  )}
                </div>
                <div className="flex gap-3 order-1 sm:order-2">
                  <button 
                    onClick={closeToolDialog} 
                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 border-2 border-gray-300 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                  >
                    Close
                  </button>
                  <button 
                    onClick={executeToolWithParams} 
                    disabled={!isFormValid() || runningTool === selectedTool.name} 
                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-xl disabled:opacity-50 hover:from-blue-700 hover:to-purple-800 flex items-center justify-center gap-2 font-semibold transition-all shadow-lg hover:shadow-xl text-sm"
                  >
                    {runningTool === selectedTool.name ? (
                      <>
                        <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                        <span className="hidden sm:inline">Executing...</span>
                        <span className="sm:hidden">Running...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="hidden sm:inline">Execute Tool</span>
                        <span className="sm:hidden">Execute</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {/* Loading State */}
        {loadingTools && <LoadingProgress />}

        {/* Tools Content - Only show when not loading */}
        {!loadingTools && (
          <>
            {/* Category Filters - Horizontal scroll on mobile */}
            <div className="mb-6 sm:mb-8">
              <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
                {categories.map(cat=>(
                  <button 
                    key={cat} 
                    onClick={()=>setSelectedCategory(cat)} 
                    className={`px-3 py-2 rounded-xl font-medium whitespace-nowrap transition-all shadow-sm text-sm ${
                    selectedCategory===cat
                        ? 'bg-gradient-to-r from-blue-600 to-purple-700 text-white shadow-lg transform scale-105' 
                        : 'bg-white border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700 hover:text-blue-700'
                    }`}
                  > 
                    {cat} 
                  </button>
                ))}
              </div>
            </div>

            {/* Error Display - Mobile Optimized */}
            {error && (
              <div className="mb-6 sm:mb-8 p-4 sm:p-5 bg-red-50 border-2 border-red-200 text-red-800 rounded-xl sm:rounded-2xl flex items-start gap-3 sm:gap-4 shadow-sm">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                </div>
                <span className="font-medium text-sm sm:text-base">{error}</span>
              </div>
            )}

            {/* Tools Grid - Responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filtered.map(tool=>(
                <div 
                  key={`${tool.name}:${tool.id}`} 
                  className="bg-white border-2 border-gray-100 rounded-xl sm:rounded-2xl p-4 sm:p-5 hover:border-blue-200 hover:shadow-xl transition-all transform hover:scale-105 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-medium ml-2">
                      {tool.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-2 line-clamp-2">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 sm:mb-5 line-clamp-3 leading-relaxed">
                    {tool.description}
                  </p>
                  <button 
                    onClick={()=>openToolDialog(tool)} 
                    disabled={!sessionPath} 
                    className="w-full px-3 sm:px-4 py-2.5 bg-blue-300 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-lg text-sm"
                  >
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline">Configure & Run</span>
                    <span className="sm:hidden">Run Tool</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Empty State - Mobile Optimized */}
            {filtered.length === 0 && !connecting && (
              <div className="text-center py-12 sm:py-20">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Search className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
                </div>
                <p className="text-gray-600 text-lg sm:text-xl font-semibold mb-2 px-4">No tools found matching your search</p>
                <p className="text-gray-500 text-base sm:text-lg px-4">Try adjusting your search terms or category filter</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdTools;
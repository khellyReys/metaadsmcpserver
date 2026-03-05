import React, { useState, useEffect, useMemo, useRef  } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Search, Play, ArrowRight, AlertCircle, CheckCircle2, X, Terminal, Loader, KeyRound } from "lucide-react";
import Spinner from './Spinner';
import ThemeToggle from './ThemeToggle';
import { getEnvVar } from '../lib/env';
import { promiseWithTimeout } from '../lib/asyncUtils';
import { useVisibilityReset } from '../hooks/useVisibilityReset';
import authService from '../auth/authService';
// @ts-expect-error - paths.js is in public folder, not typed
import { toolPaths } from '../../public/tools/paths.js';

// Pre-bundle all tool modules so Vite can resolve them at build time (dynamic import with variable path fails)
const toolModules = import.meta.glob<{ apiTool?: { definition?: { function?: { name?: string; description?: string; category?: string; parameters?: unknown }; function?: unknown } } }>('../../public/tools/**/*.js');

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
  adAccountId: string;
  pageId: string;
  serverId: string;
  serverAccessToken: string;
  userId?: string;
}

const MCP_BASE_URL = (() => {
  const envUrl = getEnvVar('VITE_MCP_URL');
  if (envUrl && envUrl.includes('metaadsmcpserver-1.onrender.com')) {
    return envUrl.replace('metaadsmcpserver-1.onrender.com', 'metaadsmcpserver.onrender.com');
  }
  // Upgrade http://localhost:* → https://localhost:* to avoid mixed-content blocks
  if (envUrl && /^http:\/\/localhost(:\d+)?/.test(envUrl)) {
    return envUrl.replace('http://', 'https://');
  }
  return envUrl || "https://metaadsmcpserver.onrender.com";
})();
//const MCP_BASE_URL = "https://metaadsmcpserver.onrender.com";

const AdTools: React.FC<AdToolsProps> = ({ businessId, adAccountId, pageId, serverId, serverAccessToken, userId = '' }) => {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<{ name?: string; email?: string; picture?: string } | null>(null);

  useEffect(() => {
    authService.checkAuthStatus().then((r) => {
      if (r.userData) setUserProfile({ name: r.userData.name, email: r.userData.email, picture: r.userData.picture });
    });
  }, []);

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

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
  const [toolResponse, setToolResponse] = useState<unknown>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const pendingRef = useRef<Map<number, (msg: unknown) => void>>(new Map());

  useVisibilityReset(() => {
    setLoadingTools(false);
    setConnecting(false);
    setRunningTool(null);
  });

  // Load tools effect
  useEffect(() => {
    async function loadTools() {
      setLoadingTools(true);
      const loaded: McpTool[] = [];
      const seen = new Set<string>();

      const loadAll = async () => {
        for (const path of toolPaths) {
          try {
            const loader = toolModules[`../../public/tools/${path}`];
            if (!loader) continue;
            const mod = await loader();
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
                category: mod.apiTool?.definition?.function?.category || category,
                parameters: def.parameters || undefined,
              });
            }
          } catch {
            // Skip tools that fail to load
          }
        }
      };

      try {
        await promiseWithTimeout(loadAll(), 20000);
      } catch {
        // Timeout or error - use whatever we loaded so far
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

  // SSE URL & handshake - using accountId for connection
  const sseBaseUrl = `${MCP_BASE_URL}/api/sse`;
  const mcpHttpBaseUrl = `${MCP_BASE_URL}/api/mcp`;
  const sseToken = useMemo(() => {
    const tokenString = `${serverId}:${serverAccessToken}`;
    return btoa(tokenString);
  }, [serverId, serverAccessToken]);
  const sseUrl = useMemo(() => {
    return `${sseBaseUrl}?token=${encodeURIComponent(sseToken)}`;
  }, [sseBaseUrl, sseToken]);
  const mcpHttpUrl = useMemo(() => {
    return `${mcpHttpBaseUrl}?token=${encodeURIComponent(sseToken)}`;
  }, [mcpHttpBaseUrl, sseToken]);
  
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
        const m = msg as { id?: number };
        if (msg && typeof m.id !== "undefined") {
          const fn = pendingRef.current.get(m.id);
          if (fn) {
            pendingRef.current.delete(m.id);
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
  const copyField = (txt: string, field: string) => async () => {
    try { await navigator.clipboard.writeText(txt); } catch { /* fallback */ }
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };
  const postRpc = async (body: object) => {
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
      let j: { error?: { message?: string; code?: number } } | null = null;
      try { j = raw ? JSON.parse(raw) : null; } catch { /* ignore */ }

      // Session expired / not found (server no longer returns session IDs for security)
      if (res.status === 400 && j?.error?.message) {
        throw new Error(j.error.message);
      }

      // Proper MCP error payload
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
  
  const callTool = async (name: string, args: Record<string, unknown>) => {
    if (!sessionPath) return;
    setRunningTool(name);
    setToolResponse(null);
    setExecutionError(null);
  
    // unique id for this JSON-RPC call
    const id = Date.now();
  
    // Promise that resolves when SSE delivers the response with matching id
    const waitForSse = new Promise<unknown>((resolve, reject) => {
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
      const postResult = await promiseWithTimeout(
        postRpc({
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: args },
        }),
        25000
      );
  
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
    } catch (e) {
      pendingRef.current.delete(id);
      setExecutionError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setRunningTool(null);
    }
  };
  
  
  
  const openToolDialog = (tool: McpTool) => {
    setSelectedTool(tool);
    
    // Dynamically extract default values from the tool's function signature
    const getDefaultValue = async (paramName: string, paramDef: { type?: string; enum?: string[]; items?: { enum?: string[] } }) => {
      try {
        // Try to get the actual tool module to extract defaults from function signature
        const toolId = tool.id; // format: "toolName:path"
        const toolPath = toolId.split(':')[1];
        
        if (toolPath) {
          try {
            const loader = toolModules[`../../public/tools/${toolPath}`];
            if (!loader) return undefined;
            const mod = await loader();
            const funcStr = mod.apiTool?.function?.toString() || '';
            
            // Parse function parameters to extract default values
            const paramMatch = funcStr.match(new RegExp(`${paramName}\\s*=\\s*([^,}]+)`));
            if (paramMatch) {
              const defaultValue = paramMatch[1].trim();
              
              // Skip template literals — they contain runtime expressions
              if (defaultValue.startsWith('`')) {
                return undefined;
              }
              // Clean up the default value and convert to proper JSON format
              if (defaultValue.startsWith("'") || defaultValue.startsWith('"')) {
                // String literal
                return defaultValue.slice(1, -1);
              } else if (defaultValue === 'true' || defaultValue === 'false') {
                // Boolean literal
                return defaultValue;
              } else if (defaultValue.startsWith('[')) {
                // Array literal - convert single quotes to double quotes for valid JSON
                try {
                  // Replace single quotes with double quotes for JSON compatibility
                  const jsonString = defaultValue.replace(/'/g, '"');
                  // Validate it's valid JSON
                  JSON.parse(jsonString);
                  return jsonString;
                } catch {
                  // If conversion fails, return empty array
                  return '[]';
                }
              } else if (!isNaN(Number(defaultValue))) {
                // Number literal
                return defaultValue;
              } else if (defaultValue === 'null') {
                return '';
              } else {
                return defaultValue;
              }
            }
          } catch {
            // Module load failed, use fallback
          }
        }
      } catch {
        // Use fallback defaults
      }
      
      // Fallback strategies with enhanced defaults
      // 1. Use first enum option if available
      if (paramDef.enum && paramDef.enum.length > 0) {
        return paramDef.enum[0];
      }
      
      // 2. Enhanced special handling for common parameter names
      if (paramName === 'account_id') {
        return adAccountId;
      } else if (paramName === 'business_id') {
        return businessId;
      } else if (paramName === 'page_id') {
        return pageId;
      } else if (paramName === 'userId') {
        return userId;
      }
      
      // 3. Type-based defaults
      if (paramDef.type === 'boolean') {
        return 'false';
      } else if (paramDef.type === 'number' || paramDef.type === 'integer') {
        return '';
      } else if (paramDef.type === 'array') {
        // For array types with enum, use first enum value in array format
        if (paramDef.items?.enum && paramDef.items.enum.length > 0) {
          return JSON.stringify([paramDef.items.enum[0]]);
        }
        return '[]';
      }
      
      return '';
    };
  
    // Set initial values for all parameters
    if (tool.parameters?.properties) {
      Promise.all(
        Object.entries(tool.parameters.properties).map(async ([key, def]) => {
          const defaultVal = await getDefaultValue(key, def);
          return [key, defaultVal];
        })
      ).then(results => {
        const values: Record<string, string> = {};
        results.forEach(([key, value]) => {
          values[key as string] = value as string;
        });
        setParameterValues(values);
      });
    }
    
    setToolResponse(null);
    setExecutionError(null);
  };
  
  const closeToolDialog = () => { setSelectedTool(null); setParameterValues({}); setToolResponse(null); setExecutionError(null); };
  const handleParameterChange = (k:string, v:string) => setParameterValues(p => ({ ...p, [k]: v }));
  const executeToolWithParams = () => {
    if (!selectedTool) return;
  
    const processed: Record<string, unknown> = {};
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
  
    if (userId) processed.userId = userId;
    callTool(selectedTool.name, processed);
  };
  
  const isFormValid = () => !selectedTool?.parameters || (selectedTool.parameters.required || []).every(r => parameterValues[r]?.trim());
  
  const handleBackToPage = () => {
    sessionStorage.setItem('backToPageFromTools', '1');
    navigate('/dashboard/page', {
      state: {
        backToStep: 'page',
        serverId,
        businessId,
        adAccountId,
      },
    });
  };
  const status = connecting ? {icon:Loader,text:'Connecting...',color:'text-yellow-600'}
                : error ? {icon:AlertCircle,text:'Connection Failed',color:'text-red-600'}
                : sessionPath ? {icon:CheckCircle2,text:'Connected',color:'text-green-600'}
                : {icon:AlertCircle,text:'Disconnected',color:'text-gray-600'};

const StatusIcon = status.icon;

interface McpContentItem { type?: string; text?: string }
const getReadableOutput = (resp: unknown): string => {
  if (!resp) return "";
  const r = resp as { result?: { content?: McpContentItem[] }; content?: McpContentItem[] };
  // SSE-delivered MCP result shape: { jsonrpc, id, result: { content: [{ type:"text", text:"..." }] } }
  const sseText = r?.result?.content?.find?.((c) => c?.type === "text")?.text;
  if (typeof sseText === "string") return sseText;

  // Direct JSON (non-SSE) fallback: sometimes servers return { content:[{type,text}] }
  const directText = r?.content?.find?.((c) => c?.type === "text")?.text;
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
      <Spinner size="sm" className="mb-4" />
      <div className="text-center space-y-2">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Loading Available Tools</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base max-w-md px-4">
          Discovering and configuring tools for your Meta Ads account...
        </p>
      </div>
    </div>
  );



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Top bar: profile left, logout right (same as Select Business / other steps) */}
      {userProfile && (
        <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {userProfile.picture && (
                  <img
                    src={userProfile.picture}
                    alt={userProfile.name}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shrink-0"
                  />
                )}
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{userProfile.name || userProfile.email}</p>
                  {userProfile.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{userProfile.email}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors shrink-0"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content: steps, title, description, back button, then tools (same layout as Select Business) */}
      <div className="max-w-7xl mx-auto p-4 pt-8">
        {/* Step Progress Indicator: 1 Server → 2 Business → 3 Ad Account → 4 Page → 5 Tools */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3 mb-6">
          <div className="flex items-center space-x-1.5 text-green-600 dark:text-green-400">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-green-100 dark:bg-green-900/40">1</div>
            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Server</span>
          </div>
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 dark:text-green-600 flex-shrink-0" />
          <div className="flex items-center space-x-1.5 text-green-600 dark:text-green-400">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-green-100 dark:bg-green-900/40">2</div>
            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Business</span>
          </div>
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 dark:text-green-600 flex-shrink-0" />
          <div className="flex items-center space-x-1.5 text-green-600 dark:text-green-400">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-green-100 dark:bg-green-900/40">3</div>
            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Ad Account</span>
          </div>
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 dark:text-green-600 flex-shrink-0" />
          <div className="flex items-center space-x-1.5 text-green-600 dark:text-green-400">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-green-100 dark:bg-green-900/40">4</div>
            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Page</span>
          </div>
          <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 dark:text-green-600 flex-shrink-0" />
          <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold bg-blue-100 dark:bg-blue-900/40">5</div>
            <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Tools</span>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">Available Tools</h1>
        <p className="text-gray-600 dark:text-gray-300 text-center mb-4">Run Meta Ads tools for your connected account</p>
        <div className="flex flex-wrap items-center justify-center mb-6">
          <button
            onClick={handleBackToPage}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>Back to page</span>
          </button>
        </div>

        {/* MCP Server Status + Credentials */}
        <div className="space-y-4 mb-2">
          <div className="flex items-center justify-center gap-3 text-sm">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${status.color}`}>
              <StatusIcon className={`w-4 h-4 flex-shrink-0 ${connecting ? 'animate-spin' : ''}`} />
              {status.text}
            </span>
            {sessionPath && (
              <button
                onClick={() => setShowCredentials(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Connection Credentials
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              disabled={loadingTools}
            />
          </div>
        </div>
      </div>

      {/* Modal Portal - Mobile Optimized */}
      {selectedTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black bg-opacity-60" onClick={closeToolDialog} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl m-2 sm:mx-4 overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Modal Header */}
            <div className="bg-blue-600 px-4 sm:px-6 py-4 text-white">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-bold truncate">{selectedTool.name}</h2>
                  <p className="text-blue-100 text-sm mt-1 line-clamp-2">{selectedTool.description}</p>
                  <span className="inline-block px-2.5 py-0.5 bg-white/20 rounded-full text-xs font-medium mt-2">
                    {selectedTool.category}
                  </span>
                </div>
                <button onClick={closeToolDialog} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0">
                  <X className="w-5 h-5"/>
                </button>
              </div>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Parameters Section */}
              <div className="p-4 sm:p-6">
                {selectedTool.parameters?.properties ? (
                  <>
                    <div className="flex items-start gap-3 text-sm text-blue-800 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg mb-5 border border-blue-200 dark:border-blue-800">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>Configure the parameters below to execute this tool</span>
                    </div>
                    <div className="space-y-4 sm:space-y-6">
                    {Object.entries(selectedTool.parameters.properties).map(([k,def]) => {
                      const required = selectedTool.parameters?.required?.includes(k);
                      
                      // Check if this parameter has enum options (predefined choices)
                      const hasEnumOptions = def.enum && Array.isArray(def.enum) && def.enum.length > 0;
                      const isArrayWithEnum = def.type === 'array' && def.items?.enum && Array.isArray(def.items.enum);
                      
                      return (
                        <div key={k}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                            <label className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                              {k} {required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-gray-700 dark:text-gray-300 font-medium w-fit">
                              {def.type}
                            </span>
                          </div>
                          {def.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 bg-gray-50 dark:bg-gray-700/50 px-3 sm:px-4 py-2 rounded-lg">
                              {def.description}
                            </p>
                          )}
                          
                          {/* Enhanced input rendering with dropdown support and proper defaults */}
                          {def.type === 'boolean' ? (
                            <select 
                              value={parameterValues[k] || 'false'} 
                              onChange={e=>handleParameterChange(k,e.target.value)} 
                              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base"
                            >
                              <option value="false">False</option>
                              <option value="true">True</option>
                            </select>
                          ) : hasEnumOptions ? (
                            // Dropdown for parameters with enum options - NO "Select" placeholder, always show default
                            <select 
                              value={parameterValues[k] || def.enum[0]} 
                              onChange={e=>handleParameterChange(k,e.target.value)} 
                              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base"
                              required={required}
                            >
                              {/* Render each enum option - no placeholder */}
                              {def.enum.map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : isArrayWithEnum ? (
                            // Multi-select for array parameters with enum options
                            <select 
                              multiple
                              value={(() => {
                                try {
                                  const val = parameterValues[k] || '[]';
                                  // Handle both JSON format and JavaScript array format
                                  if (val.startsWith('[') && val.endsWith(']')) {
                                    // Try to parse as JSON first
                                    try {
                                      return JSON.parse(val);
                                    } catch {
                                      // If JSON parse fails, try to convert single quotes to double quotes
                                      const jsonVal = val.replace(/'/g, '"');
                                      return JSON.parse(jsonVal);
                                    }
                                  }
                                  return [];
                                } catch {
                                  return [];
                                }
                              })()} 
                              onChange={e => {
                                const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
                                handleParameterChange(k, JSON.stringify(selectedValues));
                              }}
                              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base min-h-[100px]"
                              required={required}
                            >
                              {def.items.enum.map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            // Default: Regular input for other types
                            <input 
                              type={def.type==='number'?'number':'text'} 
                              value={parameterValues[k]||''} 
                              onChange={e=>handleParameterChange(k,e.target.value)} 
                              placeholder={`Enter ${k}...`} 
                              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-base" 
                              required={required} 
                            />
                          )}
                          
                          {/* Helper text for multi-select arrays */}
                          {isArrayWithEnum && (
                            <p className="text-xs text-gray-500 mt-1">
                              Hold Ctrl/Cmd to select multiple options
                            </p>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <p className="text-gray-800 dark:text-gray-100 font-semibold text-lg">No parameters required</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">This tool can be executed directly</p>
                  </div>
                )}
              </div>

              {/* Execution Logs Section */}
              {(toolResponse || executionError) && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                        <Terminal className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Execution Log</h3>
                      <div className={`ml-auto w-2.5 h-2.5 rounded-full ${executionError ? 'bg-red-500' : 'bg-green-500'}`} />
                    </div>
                    
                    <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-40 sm:max-h-60">
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

            {/* Modal Footer */}
            <div className="px-4 sm:px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400 order-2 sm:order-1">
                  {selectedTool.parameters?.required && selectedTool.parameters.required.length > 0 && (
                    <span className="font-medium">* Required fields</span>
                  )}
                </div>
                <div className="flex gap-3 order-1 sm:order-2">
                  <button 
                    onClick={closeToolDialog} 
                    className="flex-1 sm:flex-none px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition-colors text-sm"
                  >
                    Close
                  </button>
                  <button 
                    onClick={executeToolWithParams} 
                    disabled={!isFormValid() || runningTool === selectedTool.name} 
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 font-semibold transition-colors text-sm"
                  >
                    {runningTool === selectedTool.name ? (
                      <>
                        <Spinner size="sm" variant="white" className="flex-shrink-0" />
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Execute Tool</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Modal */}
      {showCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black bg-opacity-60" onClick={() => setShowCredentials(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Connection Credentials</h2>
              <button onClick={() => setShowCredentials(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Warning */}
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Copy and store these credentials securely. Do not share them publicly.</span>
              </div>

              {/* Streamable HTTP */}
              <div className="rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-800">
                <div className="bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 border-b border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Streamable HTTP</h3>
                    <span className="text-xs font-medium px-2 py-0.5 bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-full">Recommended</span>
                  </div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                    Single endpoint for all MCP communication. Supported by Cursor, Claude Desktop, and newer clients.
                  </p>
                </div>
                <div className="bg-emerald-50/40 dark:bg-emerald-900/10 p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Option 1: Endpoint + Token</label>
                    <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                      <input readOnly value={mcpHttpBaseUrl} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0" />
                      <button
                        onClick={copyField(mcpHttpBaseUrl, 'http-base')}
                        className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex-shrink-0"
                      >
                        {copiedField === 'http-base' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Token</label>
                    <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                      <input readOnly value={'●'.repeat(8)} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0 tracking-widest" />
                      <button
                        onClick={copyField(sseToken, 'http-token')}
                        className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex-shrink-0"
                      >
                        {copiedField === 'http-token' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      Use with header: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono">Authorization: Bearer &lt;token&gt;</code>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Option 2: Full URL with token</label>
                    <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                      <input readOnly value={`${mcpHttpBaseUrl}?token=${'●'.repeat(8)}`} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0" />
                      <button
                        onClick={copyField(mcpHttpUrl, 'http-full')}
                        className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex-shrink-0"
                      >
                        {copiedField === 'http-full' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
              </div>

              {/* SSE (legacy) */}
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">SSE</h3>
                    <span className="text-xs font-medium px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full">Legacy</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Server-Sent Events transport for older MCP clients that don't support Streamable HTTP.
                  </p>
                </div>
                <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Option 1: Endpoint + Token</label>
                    <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                      <input readOnly value={sseBaseUrl} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0" />
                      <button
                        onClick={copyField(sseBaseUrl, 'sse-base')}
                        className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-slate-600 dark:hover:text-slate-400 transition-colors flex-shrink-0"
                      >
                        {copiedField === 'sse-base' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Token</label>
                    <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                      <input readOnly value={'●'.repeat(8)} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0 tracking-widest" />
                      <button
                        onClick={copyField(sseToken, 'sse-token')}
                        className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-slate-600 dark:hover:text-slate-400 transition-colors flex-shrink-0"
                      >
                        {copiedField === 'sse-token' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      Use with header: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded font-mono">Authorization: Bearer &lt;token&gt;</code>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Option 2: Full URL with token</label>
                    <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700">
                      <input readOnly value={`${sseBaseUrl}?token=${'●'.repeat(8)}`} className="flex-1 p-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 bg-transparent min-w-0" />
                      <button
                        onClick={copyField(sseUrl, 'sse-full')}
                        className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hover:text-slate-600 dark:hover:text-slate-400 transition-colors flex-shrink-0"
                      >
                        {copiedField === 'sse-full' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowCredentials(false)}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3">
        {/* Loading State */}
        {loadingTools && <LoadingProgress />}

        {/* Tools Content - Only show when not loading */}
        {!loadingTools && (
          <>
            {/* Category Filters - Horizontal scroll on mobile */}
            <div className="mb-4">
              <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
                {categories.map(cat=>(
                  <button 
                    key={cat} 
                    onClick={()=>setSelectedCategory(cat)} 
                    className={`px-3 py-2 rounded-xl font-medium whitespace-nowrap transition-colors text-sm ${
                    selectedCategory===cat
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-400'
                    }`}
                  > 
                    {cat} 
                  </button>
                ))}
              </div>
            </div>

            {/* Error Display - Mobile Optimized */}
            {error && (
              <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {/* Tools Grid - Responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filtered.map(tool=>(
                <div 
                  key={`${tool.name}:${tool.id}`} 
                  className="bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-600 rounded-xl sm:rounded-2xl p-4 sm:p-5 hover:border-blue-200 dark:hover:border-blue-500 hover:shadow-xl transition-all transform hover:scale-105 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full font-medium">
                      {tool.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100 mb-2 line-clamp-2">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-5 line-clamp-3 leading-relaxed">
                    {tool.description}
                  </p>
                  <button 
                    onClick={()=>openToolDialog(tool)} 
                    disabled={!sessionPath} 
                    className="w-full px-3 sm:px-4 py-2.5 bg-blue-300 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-lg text-sm"
                  >
                    <Play className="w-4 h-4" />
                    <span className="hidden sm:inline">Test & Run</span>
                    <span className="sm:hidden">Run Tool</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Empty State - Mobile Optimized */}
            {filtered.length === 0 && !connecting && (
              <div className="text-center py-12 sm:py-20">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                  <Search className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-lg sm:text-xl font-semibold mb-2 px-4">No tools found matching your search</p>
                <p className="text-gray-500 dark:text-gray-500 text-base sm:text-lg px-4">Try adjusting your search terms or category filter</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default AdTools;
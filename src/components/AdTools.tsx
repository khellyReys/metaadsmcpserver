import React, { useState, useEffect, useMemo } from "react";
import { Copy, Search as SearchIcon } from "lucide-react";
// @ts-ignore
import { toolPaths } from "../../tools/paths.js";

interface McpTool {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface AdToolsProps {
  businessId: string;
  mcpServerLink: string;
  secret: string;
}

interface Endpoints {
  sse: string;
  http: string;
}

// Build both SSE and HTTP RPC endpoints (handshake uses SSE only)
const makeEndpoints = (base: string, token: string): Endpoints => ({
  sse: `${base}/sse?token=${token}`,
  http: `${base}/http?token=${token}`,
});

const AdTools: React.FC<AdToolsProps> = ({
  businessId,
  mcpServerLink,
  secret,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [tools, setTools] = useState<McpTool[]>([]);

  // sessionPath holds "/messages?sessionId=…" once handshake completes
  const [sessionPath, setSessionPath] = useState<string>();
  const [connecting, setConnecting] = useState(true);

  // Load and dedupe tools on mount
  useEffect(() => {
    async function loadTools() {
      const loaded: McpTool[] = [];
      const seen = new Set<string>();
      for (const path of toolPaths) {
        try {
          const mod = await import(
            `../../tools/${path}`
          );
          const apiTool = mod.apiTool;
          const def = apiTool?.definition?.function;
          if (def?.name && def?.description && !seen.has(def.name)) {
            seen.add(def.name);
            loaded.push({
              id: `${def.name}:${path}`,
              name: def.name,
              description: def.description,
              category:
                apiTool.definition.function.category ?? "Uncategorized",
            });
          }
        } catch (err) {
          console.error("Error loading tool:", path, err);
        }
      }
      setTools(loaded);
    }
    loadTools();
  }, []);

  // Filter categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(tools.map((t) => t.category))).sort();
    return ["All", ...cats];
  }, [tools]);

  // Filter tools by search & category
  const filtered = useMemo(
    () =>
      tools.filter((tool) => {
        const matchesSearch = tool.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchesCat =
          selectedCategory === "All" || tool.category === selectedCategory;
        return matchesSearch && matchesCat;
      }),
    [tools, searchTerm, selectedCategory]
  );

  // Compute endpoints and base URL
  const { sse, http } = useMemo(() => {
    const token = btoa(`${businessId}:${secret}`);
    const base = mcpServerLink || "http://localhost:5173";
    return makeEndpoints(base, token);
  }, [businessId, secret, mcpServerLink]);

  // Clipboard helper
  const copyToClipboard = (text: string) => () =>
    navigator.clipboard.writeText(text);

  // Step: handshake to get sessionPath via SSE 'endpoint' event
  useEffect(() => {
    setConnecting(true);
    setSessionPath(undefined);

    console.log("▶️  Opening SSE:", sse);
    const es = new EventSource(sse);
    es.addEventListener("endpoint", (e: MessageEvent) => {
      setSessionPath(e.data); // e.g. "/messages?sessionId=abc123"
      setConnecting(false);
      es.close();
    });
    es.onerror = () => {
      console.error("SSE handshake failed");
      setConnecting(false);
      es.close();
    };
    return () => {
      es.close();
    };
  }, [sse]);

  // Derive base URL for rendering full paths
  const base = mcpServerLink || "http://localhost:5173";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              MCP Tools Library
            </h1>
            <p className="text-gray-600 text-sm">Business ID: {businessId}</p>
          </div>

          {/* Connection URLs */}
          <div className="w-full md:w-auto">
            {connecting ? (
              <p className="text-gray-500 text-sm">
                Connecting to MCP server…
              </p>
            ) : sessionPath ? (
              <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
                {/* SSE Handshake URL */}
                <div className="flex-1 flex">
                  <input
                    readOnly
                    value={sse}
                    className="flex-1 border rounded-l-md px-3 py-2 font-mono text-sm"
                  />
                  <button
                    onClick={copyToClipboard(sse)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-r-md"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {/* HTTP POST URL with sessionId */}
                <div className="flex-1 flex">
                  <input
                    readOnly
                    value={`${base}${sessionPath}`}
                    className="flex-1 border rounded-l-md px-3 py-2 font-mono text-sm"
                  />
                  <button
                    onClick={copyToClipboard(`${base}${sessionPath}`)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-r-md"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-red-500 text-sm">Failed to connect.</p>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Copy either the SSE or HTTP RPC endpoint to connect your MCP client.
          </p>
        </div>
      </header>

      {/* BODY */}
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-5 gap-8">
        <aside className="lg:col-span-1">
          <nav className="space-y-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </nav>
        </aside>

        <section className="lg:col-span-4 space-y-6">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <SearchIcon className="w-5 h-5 text-gray-400 ml-3" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {filtered.length > 0 ? (
              filtered.map((tool) => (
                <div
                  key={tool.id}
                  className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {tool.description}
                  </p>
                  <span className="inline-block text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {tool.category}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 col-span-full text-center">
                No tools found.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdTools;

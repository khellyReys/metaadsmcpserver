import React, { useState, useEffect, useMemo } from "react";
import { Copy, Search as SearchIcon } from "lucide-react";

interface McpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
  category?: string;
}

interface AdToolsProps {
  businessId: string;
  mcpServerLink: string; // e.g. https://mcp.yourdomain.com
  secret: string;
}

interface Endpoints {
  sse: string;
  http: string;
}

const makeEndpoints = (base: string, token: string): Endpoints => ({
  sse: `${base}/sse?token=${token}`,
  http: `${base}/http?token=${token}`,
});

const AdTools: React.FC<AdToolsProps> = ({
  businessId,
  mcpServerLink,
  secret,
}) => {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("All");
  const [sessionPath, setSessionPath] = useState<string>();
  const [connecting, setConnecting] = useState(true);

  // 1) Compute endpoints (no change)
  const { sse, http } = useMemo(() => {
    const token = btoa(`${businessId}:${secret}`);
    return makeEndpoints(mcpServerLink, token);
  }, [businessId, secret, mcpServerLink]);

  // 2) SSE handshake to get sessionPath
  useEffect(() => {
    setConnecting(true);
    const es = new EventSource(sse);
    es.addEventListener("endpoint", (e) => {
      setSessionPath(e.data);
      setConnecting(false);
      es.close();
    });
    es.onerror = () => {
      console.error("Handshake failed");
      setConnecting(false);
      es.close();
    };
    return () => es.close();
  }, [sse]);

  // 3) Fetch tool list via HTTP JSON‑RPC POST to /http
  useEffect(() => {
    if (!sessionPath) return;
    (async () => {
      const rpcUrl = `${mcpServerLink}${sessionPath.replace(
        "/messages",
        "/http"
      )}`;
      try {
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "list-tools",
            params: {},
          }),
        });
        const { result } = await res.json();
        setTools(result.tools || result);
      } catch (err) {
        console.error("Failed to load tools", err);
      }
    })();
  }, [sessionPath, mcpServerLink]);

  // 4) Filtered & categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(tools.map((t) => t.category || "None")));
    return ["All", ...cats];
  }, [tools]);
  const filtered = useMemo(
    () =>
      tools.filter((t) => {
        return (
          t.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          (category === "All" || t.category === category)
        );
      }),
    [tools, searchTerm, category]
  );

  const copy = (text: string) => () => navigator.clipboard.writeText(text);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="…">
        {/* …identical connection URL UI… */}
      </header>
      <main className="…">
        {/* search & filter UI… */}
        <div className="grid …">
          {filtered.map((t) => (
            <div key={t.name} className="…">
              <h3>{t.name}</h3>
              <p>{t.description}</p>
              <span>{t.category}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdTools;

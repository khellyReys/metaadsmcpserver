#!/usr/bin/env node

// ---- Early debug so we see *something* even if imports fail ----
process.on('beforeExit', (code) => console.log('[beforeExit]', code));
process.on('exit', (code) => console.log('[exit]', code));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
console.log('mcpServer.js starting…');

// ---- ESM imports ----
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import http from "http";
import https from "https";
import { fileURLToPath } from "url";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { discoverTools } from "./lib/tools.js";
import { getSupabaseClient, getTokenForUser, setFallbackToken, clearFallbackToken } from "./public/tools/facebook-marketing-api/facebook-marketing-api-mapi/_token-utils.js";

// ---- Env setup ----
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env"),
});

// ---- Constants ----
const SERVER_NAME = "generated-mcp-server";

// ---- Helpers ----
function validateToken(token) {
  if (!token) {
    throw new Error("Token is required");
  }
  try {
    const decoded = Buffer.from(String(token), "base64").toString("utf-8");
    if (!decoded.includes(":")) {
      throw new Error("Invalid token format");
    }
    const [serverId, accessToken] = decoded.split(":");
    if (!serverId || !accessToken) {
      throw new Error("Invalid token components");
    }
    return { serverId, accessToken };
  } catch (error) {
    throw new Error(`Token validation failed: ${error.message}`);
  }
}

async function transformTools(tools) {
  return tools
    .map((tool) => {
      const fn = tool.definition?.function;
      if (!fn) return null;
      return {
        name: fn.name,
        description: fn.description,
        inputSchema: fn.parameters,
      };
    })
    .filter(Boolean);
}

async function setupServerHandlers(server, tools) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const t = await transformTools(tools);
    return { tools: t };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const tool = tools.find((t) => t.definition?.function?.name === name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    if (typeof tool.function !== "function") {
      throw new McpError(
        ErrorCode.InternalError,
        `Tool "${name}" has no executable function (missing .function).`
      );
    }

    const args = request.params.arguments ?? {};
    const required = tool.definition?.function?.parameters?.required || [];
    for (const param of required) {
      if (!(param in args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Missing required parameter: ${param}`
        );
      }
    }

    // Ensure the ad account → user mapping exists in DB so all tools can resolve the token
    if (args.userId && args.account_id) {
      try {
        const supabase = getSupabaseClient();
        const accountIdStr = String(args.account_id).trim().replace(/^act_/, '');
        await supabase.from('facebook_ad_accounts').upsert(
          { id: accountIdStr, user_id: args.userId },
          { onConflict: 'id', ignoreDuplicates: false }
        );
      } catch {
        // Best-effort; tools will fall back to their own lookup
      }
    }
    // Set fallback token from userId in case some tools don't do account lookup at all
    if (args.userId) {
      try {
        const supabase = getSupabaseClient();
        const token = await getTokenForUser(supabase, args.userId);
        if (token) setFallbackToken(token);
      } catch {
        // Best-effort fallback
      }
    }

    try {
      const result = await tool.function(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const isProd = process.env.NODE_ENV === "production";
      const message = isProd ? "Tool execution failed." : `Tool execution failed: ${err.message}`;
      throw new McpError(ErrorCode.InternalError, message);
    } finally {
      clearFallbackToken();
    }
  });
}

// Helper function to set SSE headers
function setSSEHeaders(res, origin) {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('X-Accel-Buffering', 'no');
  }
}

// Helper function to send SSE error and close connection
function sendSSEError(res, error, origin) {
  if (!res.headersSent && !res.destroyed) {
    try {
      setSSEHeaders(res, origin);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ 
        error: error.message || String(error),
        timestamp: new Date().toISOString()
      })}\n\n`);
      res.end();
    } catch (writeErr) {
      console.error("[Error in sendSSEError]", writeErr);
    }
  }
}

async function run() {
  // TEMP keepalive so failures don't insta-exit before logs flush
  const keepalive = setInterval(() => {}, 1 << 30);
  process.on("exit", () => clearInterval(keepalive));

  // Node version sanity
  const [major] = process.versions.node.split(".").map(Number);
  if (Number.isFinite(major) && major < 18) {
    throw new Error(`Node 18+ required. You are on ${process.version}`);
  }

  const isSSE = process.argv.includes("--sse");
  console.log("[mode]", isSSE ? "SSE" : "STDIO");

  // Load tools (common crash point)
  let tools = [];
  try {
    tools = await discoverTools();
    console.log("[discoverTools] loaded", tools.length, "tools");
  } catch (e) {
    console.error(
      "[discoverTools] failed:",
      e && e.stack ? e.stack : e
    );
    tools = [];
  }

  if (isSSE) {
    const app = express();

    // In-memory session registry
    const transports = {};
    const servers = {};

    // CORS — allow any localhost port (for dev) plus production Render origins
    const prodOrigins = [
      "https://metaadsmcpserver-1.onrender.com",
      "https://metaadsmcpserver.onrender.com",
    ];

    app.use(
      cors({
        origin: (incomingOrigin, callback) => {
          if (!incomingOrigin) return callback(null, true);
          if (/^https?:\/\/localhost(:\d+)?$/.test(incomingOrigin)) return callback(null, true);
          if (prodOrigins.includes(incomingOrigin)) return callback(null, true);
          return callback(new Error(`Origin ${incomingOrigin} not allowed by CORS`));
        },
        methods: ["GET", "POST", "DELETE", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "Cache-Control",
          "X-Requested-With",
          "Mcp-Session-Id",
        ],
        exposedHeaders: ["Mcp-Session-Id"],
        credentials: true,
      })
    );

    // Request logger: do not log headers or token (security)
    app.use((req, res, next) => {
      const q = req.query && Object.keys(req.query).length ? Object.keys(req.query).filter(k => k !== 'token').join(',') : '';
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} from ${req.headers.origin || 'no-origin'}${q ? ` query: ${q}` : ''}`);
      next();
    });

    // ===== API ROUTES FIRST - THESE MUST COME BEFORE ANY STATIC SERVING =====
    
    // Health endpoint (no session count to avoid information disclosure)
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        server: SERVER_NAME,
        node: process.version,
        mode: "SSE",
        timestamp: new Date().toISOString()
      });
    });

    // Preflight for SSE and Streamable HTTP
    app.options(["/api/sse", "/api/mcp"], (req, res) => {
      console.log(`[PREFLIGHT] ${req.path} route hit`);
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Cache-Control, X-Requested-With, Mcp-Session-Id"
      );
      res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.status(200).end();
    });

    // CHANGE: Use /api/sse instead of /sse to avoid conflicts
    app.get("/api/sse", async (req, res) => {
      const origin = req.headers.origin;
      try {
        console.log("[SSE] Incoming connection from:", origin || "no-origin");
        // Validate token first before setting headers
        const token = req.query.token;
        if (!token) {
          throw new Error("Token parameter is required");
        }
        
        const tokenData = validateToken(token);
        console.log("[SSE] Token validated for serverId:", tokenData.serverId);
        // Do not log token or query params

        // Set SSE headers BEFORE creating transport
        setSSEHeaders(res, origin);

        // Create MCP server instance
        const server = new Server(
          { name: SERVER_NAME, version: "0.1.0" },
          { capabilities: { tools: {} } }
        );
        
        server.onerror = (err) => {
          console.error("[MCP server error]", err);
          if (!res.headersSent && !res.destroyed) {
            try {
              res.write(`event: error\n`);
              res.write(`data: ${JSON.stringify({ 
                error: err.message || String(err),
                timestamp: new Date().toISOString()
              })}\n\n`);
              res.end();
            } catch (writeErr) {
              console.error("[Error writing error response]", writeErr);
            }
          }
        };

        // Setup request handlers
        await setupServerHandlers(server, tools);

        // Create SSE transport - CHANGE: Use /api/messages
        const transport = new SSEServerTransport("/api/messages", res);
        transports[transport.sessionId] = transport;
        servers[transport.sessionId] = server;

        console.log("[SSE] New session created:", transport.sessionId, "for serverId:", tokenData.serverId);

        // Handle connection close
        res.on("close", async () => {
          console.log("[SSE] Connection closed for session:", transport.sessionId);
          delete transports[transport.sessionId];
          try {
            await server.close();
          } catch (e) {
            console.error("[server.close error]", e);
          }
          delete servers[transport.sessionId];
        });

        // Handle client disconnect
        res.on("error", (error) => {
          console.error("[SSE] Connection error:", error);
          delete transports[transport.sessionId];
          delete servers[transport.sessionId];
        });

        // Connect the server to transport
        await server.connect(transport);
        console.log("[SSE] Server connected successfully for session:", transport.sessionId);

      } catch (error) {
        console.error("[/api/sse error]", error && error.stack ? error.stack : error);
        
        // Send error as SSE event instead of JSON response
        if (!res.headersSent && !res.destroyed) {
          try {
            setSSEHeaders(res, origin);
            res.write(`event: error\n`);
            res.write(`data: ${JSON.stringify({ 
              error: error.message || String(error),
              timestamp: new Date().toISOString()
            })}\n\n`);
            res.end();
          } catch (writeErr) {
            console.error("[Error writing error response]", writeErr);
          }
        }
      }
    });

    // Parse JSON for all routes except those where the SDK handles raw body
    app.use((req, res, next) => {
      if (req.path === "/api/messages" || req.path === "/api/mcp") return next();
      return express.json()(req, res, next);
    });

    // JSON-RPC companion endpoint for SSE transport
    app.post("/api/messages", async (req, res) => {
      console.log('[MESSAGES] /api/messages route hit');
      try {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        const server = servers[sessionId];

        if (transport && server) {
          await transport.handlePostMessage(req, res);
        } else {
          console.error("[/api/messages] No transport found for sessionId (session expired or invalid)");
          res.status(400).json({
            error: "Session not found or expired. Please reconnect to the MCP server.",
          });
        }
      } catch (error) {
        console.error("[/api/messages error]", error && error.stack ? error.stack : error);
        const isProd = process.env.NODE_ENV === "production";
        res.status(500).json({
          error: isProd ? "Internal server error." : (error.message || String(error)),
        });
      }
    });

    // ===== STREAMABLE HTTP TRANSPORT (protocol version 2025-03-26) =====
    // Single endpoint handles GET (SSE stream), POST (JSON-RPC), DELETE (session teardown)
    app.all("/api/mcp", express.json(), async (req, res) => {
      console.log(`[MCP-HTTP] ${req.method} /api/mcp`);

      // Validate token from query param or Authorization header
      let tokenData;
      try {
        const tokenParam = req.query.token;
        const authHeader = req.headers.authorization;
        let rawToken;
        if (tokenParam) {
          rawToken = tokenParam;
        } else if (authHeader && authHeader.startsWith("Bearer ")) {
          rawToken = authHeader.slice(7);
        }
        if (!rawToken) {
          return res.status(401).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Authentication required. Provide token as query param or Bearer header." },
            id: null,
          });
        }
        tokenData = validateToken(rawToken);
      } catch (err) {
        return res.status(401).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: err.message },
          id: null,
        });
      }

      try {
        const sessionId = req.headers["mcp-session-id"];
        let transport;

        if (sessionId && transports[sessionId]) {
          const existing = transports[sessionId];
          if (existing instanceof StreamableHTTPServerTransport) {
            transport = existing;
          } else {
            return res.status(400).json({
              jsonrpc: "2.0",
              error: { code: -32000, message: "Session exists but uses a different transport protocol" },
              id: null,
            });
          }
        } else if (!sessionId && req.method === "POST" && isInitializeRequest(req.body)) {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sid) => {
              console.log(`[MCP-HTTP] Session initialized: ${sid} for serverId: ${tokenData.serverId}`);
              transports[sid] = transport;
            },
          });

          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && transports[sid]) {
              console.log(`[MCP-HTTP] Session closed: ${sid}`);
              delete transports[sid];
              delete servers[sid];
            }
          };

          const server = new Server(
            { name: SERVER_NAME, version: "0.1.0" },
            { capabilities: { tools: {} } }
          );
          server.onerror = (err) => console.error("[MCP-HTTP server error]", err);
          await setupServerHandlers(server, tools);
          await server.connect(transport);

          if (transport.sessionId) {
            servers[transport.sessionId] = server;
          }
        } else {
          return res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request: No valid session ID provided" },
            id: null,
          });
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error("[/api/mcp error]", error && error.stack ? error.stack : error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    });

    // ===== STATIC FILE SERVING - MUST BE AFTER API ROUTES =====
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Check if dist folder exists
    const distPath = path.join(__dirname, 'dist');
    console.log('[STATIC] Checking for dist folder at:', distPath);
    
    // Serve static files from dist folder with explicit path prefix
    app.use('/static', express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        console.log('[STATIC] Serving file:', filePath);
        if (path.extname(filePath) === '.html') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      }
    }));

    // Serve the main index.html at root and common SPA routes
    app.get('/', (req, res) => {
      console.log('[ROOT] Serving index.html');
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('[ROOT] Error serving index.html:', err);
          res.status(200).send(`
            <h1>MCP Server Running</h1>
            <p>Server is running in SSE mode</p>
            <p>API endpoints:</p>
            <ul>
              <li><a href="/health">/health</a> - Health check</li>
              <li>/api/sse - SSE endpoint</li>
              <li>/api/messages - Messages endpoint</li>
            </ul>
          `);
        }
      });
    });

    // Handle specific common SPA routes (dashboard step-based URLs and workspace)
    app.get('/workspace', (req, res) => {
      console.log('[WORKSPACE] Serving index.html for workspace route');
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('[WORKSPACE] Error serving index.html:', err);
          res.status(404).send('Page not found');
        }
      });
    });
    app.get('/dashboard', (req, res) => {
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('[DASHBOARD] Error serving index.html:', err);
          res.status(404).send('Page not found');
        }
      });
    });
    app.get('/dashboard/{*splat}', (req, res) => {
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('[DASHBOARD] Error serving index.html:', err);
          res.status(404).send('Page not found');
        }
      });
    });

    // Express error handler
    app.use((error, req, res, next) => {
      console.error("[Express error handler]", error);
      if (res.headersSent) {
        return next(error);
      }
      const isProd = process.env.NODE_ENV === "production";
      res.status(500).json({
        error: "Internal server error",
        message: isProd ? undefined : error.message,
      });
    });

    const port = process.env.PORT || 3001;
    const host = process.env.HOST || "0.0.0.0";

    // Use HTTPS only for local dev with cert files; force plain HTTP on Render/production.
    const __filename2 = fileURLToPath(import.meta.url);
    const __dirname2 = path.dirname(__filename2);
    const keyPath = path.join(__dirname2, 'localhost-key.pem');
    const certPath = path.join(__dirname2, 'localhost-cert.pem');
    const isHosted = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    const hasLocalCerts = fs.existsSync(keyPath) && fs.existsSync(certPath);
    const useHttps = !isHosted && hasLocalCerts;
    const netServer = useHttps
      ? https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, app)
      : http.createServer(app);
    const protocol = useHttps ? 'https' : 'http';

    netServer.on('error', (err) => {
      console.error(`[server error] ${err.message}`);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the other process or set PORT=<other> in .env`);
      }
      process.exit(1);
    });

    netServer.listen(port, host, () => {
      console.log(`MCP server listening on ${protocol}://${host}:${port}`);
      console.log(`Health:          ${protocol}://${host}:${port}/health`);
      console.log(`SSE (legacy):    ${protocol}://${host}:${port}/api/sse`);
      console.log(`Streamable HTTP: ${protocol}://${host}:${port}/api/mcp`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Static files: ${distPath}`);
      // keepalive stays active — the server socket keeps the event loop alive,
      // but we keep the interval as a safety net on Windows where socket ref can be tricky.
    });
  } else {
    // STDIO mode (single session over stdin/stdout)
    const server = new Server(
      { name: SERVER_NAME, version: "0.1.0" },
      { capabilities: { tools: {} } }
    );
    server.onerror = (err) => console.error("[MCP Error]", err);

    await setupServerHandlers(server, tools);

    process.on("SIGINT", async () => {
      try {
        await server.close();
      } finally {
        process.exit(0);
      }
    });

    const { StdioServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/stdio.js"
    );
    const transport = new StdioServerTransport();
    console.log("[stdio] waiting for client on stdin/stdout…");
    // Clear keepalive once connected (stdio keeps process alive while attached)
    await server.connect(transport);
    clearInterval(keepalive);
  }
}

// ---- Entry with loud error logging ----
run().catch((err) => {
  console.error("[run error]", err && err.stack ? err.stack : err);
  process.exit(1);
});
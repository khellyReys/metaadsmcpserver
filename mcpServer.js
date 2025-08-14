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
import { fileURLToPath } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { discoverTools } from "./lib/tools.js";

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
    const tool = tools.find((t) => t.definition.function.name === name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    const args = request.params.arguments ?? {};
    const required = tool.definition.function.parameters.required || [];
    for (const param of required) {
      if (!(param in args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Missing required parameter: ${param}`
        );
      }
    }

    try {
      const result = await tool.function(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${err.message}`
      );
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

    // CORS (adjust to your frontend origins)
    const allowedOrigins = [
      "http://localhost:3000",
      "https://localhost:3000",
      "http://localhost:5173",
      "https://localhost:5173",
      "https://metaadsmcpserver-1.onrender.com",
      "https://metaadsmcpserver.onrender.com",
    ];

    app.use(
      cors({
        origin: (incomingOrigin, callback) => {
          if (!incomingOrigin) return callback(null, true);
          if (allowedOrigins.includes(incomingOrigin)) return callback(null, true);
          return callback(new Error(`Origin ${incomingOrigin} not allowed by CORS`));
        },
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "Cache-Control",
          "X-Requested-With",
        ],
        credentials: true,
      })
    );

    // CRITICAL: Global request logger to see what routes are being hit
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} from ${req.headers.origin || 'no-origin'}`);
      console.log(`[HEADERS]`, req.headers);
      next();
    });

    // ===== API ROUTES FIRST - THESE MUST COME BEFORE ANY STATIC SERVING =====
    
    // Health endpoint
    app.get("/health", (req, res) => {
      console.log('[HEALTH] Route hit');
      res.json({
        status: "ok",
        server: SERVER_NAME,
        activeSessions: Object.keys(transports).length,
        node: process.version,
        mode: "SSE",
        timestamp: new Date().toISOString()
      });
    });

    // Preflight for SSE
    app.options("/api/sse", (req, res) => {
      console.log('[PREFLIGHT] /api/sse route hit');
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Cache-Control, X-Requested-With"
      );
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.status(200).end();
    });

    // CHANGE: Use /api/sse instead of /sse to avoid conflicts
    app.get("/api/sse", async (req, res) => {
      console.log('[SSE] /api/sse route hit');
      const origin = req.headers.origin;
      
      try {
        console.log("[SSE] Incoming connection from:", origin);
        console.log("[SSE] Query params:", req.query);
        
        // Validate token first before setting headers
        const token = req.query.token;
        if (!token) {
          throw new Error("Token parameter is required");
        }
        
        const tokenData = validateToken(token);
        console.log("[SSE] Token validated for serverId:", tokenData.serverId);

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

    // Only parse JSON for non-/api/messages routes (SDK uses raw body)
    app.use((req, res, next) => {
      if (req.path === "/api/messages") return next();
      return express.json()(req, res, next);
    });

    // JSON-RPC companion endpoint - CHANGE: Use /api/messages
    app.post("/api/messages", async (req, res) => {
      console.log('[MESSAGES] /api/messages route hit');
      try {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        const server = servers[sessionId];

        if (transport && server) {
          await transport.handlePostMessage(req, res);
        } else {
          console.error("[/api/messages] No transport/server found for sessionId:", sessionId);
          console.error("[/api/messages] Available sessions:", Object.keys(transports));
          res.status(400).json({
            error: "No transport/server found for sessionId",
            sessionId: sessionId,
            availableSessions: Object.keys(transports),
          });
        }
      } catch (error) {
        console.error("[/api/messages error]", error && error.stack ? error.stack : error);
        res.status(500).json({ error: error.message || String(error) });
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

    // Handle specific common SPA routes if needed
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

    // Express error handler
    app.use((error, req, res, next) => {
      console.error("[Express error handler]", error);
      if (res.headersSent) {
        return next(error);
      }
      res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    });

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`MCP SSE server listening on http://localhost:${port}`);
      console.log(`Health: http://localhost:${port}/health`);
      console.log(`SSE: http://localhost:${port}/api/sse`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Static files: ${distPath}`);
      // Clear keepalive once we're listening (server keeps event loop alive)
      clearInterval(keepalive);
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
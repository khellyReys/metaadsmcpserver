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

// Helper function to set SSE headers - UPDATED
function setSSEHeaders(res, origin) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("X-Accel-Buffering", "no");
}

// Helper function to send SSE error and close connection
function sendSSEError(res, error, origin) {
  if (!res.headersSent) {
    setSSEHeaders(res, origin);

  }
  
  res.write(`event: error\n`);
  res.write(`data: ${JSON.stringify({ 
    error: error.message || String(error),
    timestamp: new Date().toISOString()
  })}\n\n`);
  res.end();
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

    // Only parse JSON for non-/messages routes (SDK uses raw body)
    app.use((req, res, next) => {
      if (req.path === "/messages") return next();
      return express.json()(req, res, next);
    });

    // DEBUG: Log all requests to see what's being hit
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, 
        req.query, req.headers.origin || 'no-origin');
      next();
    });

    // Health endpoint - MUST be before static files
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        server: SERVER_NAME,
        activeSessions: Object.keys(transports).length,
        node: process.version,
        mode: "SSE",
      });
    });

    // Preflight for SSE - MUST be before static files
    app.options("/sse", (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Cache-Control, X-Requested-With"
      );
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.status(200).end();
    });

    // SSE route debugging middleware
    app.use('/sse', (req, res, next) => {
      console.log('[DEBUG] SSE route hit with method:', req.method, 'and path:', req.path);
      console.log('[DEBUG] Headers:', req.headers);
      next();
    });

    // SSE handshake (creates a session) - MUST be before static files
    app.get("/sse", async (req, res) => {
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

        // Set SSE headers immediately after validation
        setSSEHeaders(res, origin);

        // Flush headers so proxies/CDNs recognize streaming
        if (typeof res.flushHeaders === "function") {
          res.flushHeaders();
        }

        // Send a comment every 15s so proxies don't close idle connections
        const keepAliveTimer = setInterval(() => {
          try { res.write(`: keep-alive ${Date.now()}\n\n`); } catch {}
        }, 15000);

        // Create MCP server instance
        const server = new Server(
          { name: SERVER_NAME, version: "0.1.0" },
          { capabilities: { tools: {} } }
        );
        
        server.onerror = (err) => {
          console.error("[MCP server error]", err);
          if (!res.headersSent) {
            sendSSEError(res, err, origin);
          }
        };

        // Setup request handlers
        await setupServerHandlers(server, tools);

        // Create SSE transport
        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        servers[transport.sessionId] = server;

        console.log("[SSE] New session created:", transport.sessionId, "for serverId:", tokenData.serverId);

        // Handle connection close
        res.on("close", async () => {
          console.log("[SSE] Connection closed for session:", transport.sessionId);
          clearInterval(keepAliveTimer);
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
        console.error("[/sse error]", error && error.stack ? error.stack : error);
        
        // Send error as SSE event instead of JSON response
        sendSSEError(res, error, origin);
      }
    });

    // JSON-RPC companion endpoint - MUST be before static files
    app.post("/messages", async (req, res) => {
      try {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        const server = servers[sessionId];

        if (transport && server) {
          await transport.handlePostMessage(req, res);
        } else {
          console.error("[/messages] No transport/server found for sessionId:", sessionId);
          console.error("[/messages] Available sessions:", Object.keys(transports));
          res.status(400).json({
            error: "No transport/server found for sessionId",
            sessionId: sessionId,
            availableSessions: Object.keys(transports),
          });
        }
      } catch (error) {
        console.error("[/messages error]", error && error.stack ? error.stack : error);
        res.status(500).json({ error: error.message || String(error) });
      }
    });

    // ===== STATIC FILE SERVING - MUST BE AFTER API ROUTES =====
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Serve static files from dist folder (if it exists)
    const distPath = path.join(__dirname, 'dist');
    console.log('[STATIC] Serving static files from:', distPath);
    
    app.use(express.static(distPath, {
      // Don't serve index.html automatically for routes
      index: false,
      // Cache control for static assets
      setHeaders: (res, filePath) => {
        // Don't cache HTML files to ensure fresh content
        if (path.extname(filePath) === '.html') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          // Cache other assets for 1 day
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      }
    }));

    // Catch-all handler for SPA (MUST be absolute last route)
    app.get('(.*)', (req, res) => {
      console.log('[CATCH-ALL] Serving index.html for:', req.path);
      const indexPath = path.join(__dirname, 'dist', 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error('[CATCH-ALL] Error serving index.html:', err);
          res.status(404).send('Page not found');
        }
      });
    });
    
    

    // Express error handler - should rarely be hit now
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
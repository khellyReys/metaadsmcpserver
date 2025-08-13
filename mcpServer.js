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

async function run() {
  // TEMP keepalive so failures don’t insta-exit before logs flush
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

    // Health
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        server: SERVER_NAME,
        activeSessions: Object.keys(transports).length,
        node: process.version,
        mode: "SSE",
      });
    });

    // Preflight
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

    // SSE handshake (creates a session)
    app.get("/sse", async (resReq, res) => {
      try {
        const token = resReq.query.token;
        const tokenData = validateToken(token);

        // Explicit SSE/CORS headers
        res.setHeader("Access-Control-Allow-Origin", resReq.headers.origin || "*");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering

        const server = new Server(
          { name: SERVER_NAME, version: "0.1.0" },
          { capabilities: { tools: {} } }
        );
        server.onerror = (err) => console.error("[MCP server error]", err);

        await setupServerHandlers(server, tools);

        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        servers[transport.sessionId] = server;

        console.log("[SSE] new session", transport.sessionId, "for", tokenData.serverId);

        res.on("close", async () => {
          console.log("[SSE] close", transport.sessionId);
          delete transports[transport.sessionId];
          try {
            await server.close();
          } catch (e) {
            console.error("[server.close error]", e);
          }
          delete servers[transport.sessionId];
        });

        await server.connect(transport);
      } catch (error) {
        console.error("[/sse error]", error && error.stack ? error.stack : error);
        res.status(400).json({
          error: error.message || String(error),
          details: "Token validation or server setup failed",
        });
      }
    });

    // JSON-RPC companion endpoint
    app.post("/messages", async (req, res) => {
      try {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        const server = servers[sessionId];

        if (transport && server) {
          await transport.handlePostMessage(req, res);
        } else {
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

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`MCP SSE server listening on http://localhost:${port}`);
      console.log(`Health: http://localhost:${port}/health`);
      // Clear keepalive once we’re listening (server keeps event loop alive)
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

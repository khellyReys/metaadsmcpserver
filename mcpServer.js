#!/usr/bin/env node

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

dotenv.config({
  path: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".env"
  ),
});

const SERVER_NAME = "generated-mcp-server";

// Token validation function (add your own logic here)
function validateToken(token) {
  if (!token) {
    throw new Error("Token is required");
  }
  
  try {
    // Decode the base64 token
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    
    // Add your token validation logic here
    // For example, check if it contains expected server ID and access token
    if (!decoded.includes(':')) {
      throw new Error("Invalid token format");
    }
    
    const [serverId, accessToken] = decoded.split(':');
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
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: await transformTools(tools),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const tool = tools.find((t) => t.definition.function.name === name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    const args = request.params.arguments;
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
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
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
  const isSSE = process.argv.includes("--sse");
  const tools = await discoverTools();

  if (isSSE) {
    const app = express();
    const transports = {};
    const servers = {};

    const allowedOrigins = [
      "http://localhost:3000",           // Your React dev server
      "https://localhost:3000",          // HTTPS localhost
      "http://localhost:5173",           // Vite default
      "https://localhost:5173",          // HTTPS Vite
      "https://metaadsmcpserver-1.onrender.com" // Replace with your actual frontend domain
    ];
    
    // CORS configuration
    app.use(
      cors({
        origin: (incomingOrigin, callback) => {
          // Allow requests with no origin (like mobile apps or curl)
          if (!incomingOrigin) {
            callback(null, true);
            return;
          }
          
          if (allowedOrigins.includes(incomingOrigin)) {
            callback(null, true);
          } else {
            console.error(`CORS blocked origin: ${incomingOrigin}`);
            callback(new Error(`Origin ${incomingOrigin} not allowed by CORS`));
          }
        },
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: [
          "Content-Type", 
          "Authorization", 
          "Cache-Control", 
          "X-Requested-With"
        ],
        credentials: true,
      })
    );

    // Conditional JSON parsing middleware
    app.use((req, res, next) => {
      if (req.path === "/messages") {
        next(); // skip JSON parsing for SSE message handling
      } else {
        express.json()(req, res, next);
      }
    });

    // FIXED: Proper OPTIONS handling for SSE endpoint
    app.options("/sse", (req, res) => {
      const origin = req.headers.origin;
      if (!origin || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.status(200).end();
      } else {
        res.status(403).json({ error: 'Origin not allowed' });
      }
    });

    // FIXED: SSE endpoint with proper headers
    app.get("/sse", async (req, res) => {
      console.log(`SSE request from origin: ${req.headers.origin}`);
      
      try {
        // Validate token from query parameter
        const token = req.query.token;
        const tokenData = validateToken(token);
        console.log(`Token validated for server: ${tokenData.serverId}`);
        
        // RENDER-SPECIFIC: Set headers to bypass Nginx buffering
        const origin = req.headers.origin;
        if (origin && allowedOrigins.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        
        // Critical SSE headers for Render's Nginx
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Critical for Render's Nginx
        
        // Additional headers that can help with proxy issues
        res.setHeader('Transfer-Encoding', 'chunked');
        
        // Immediately flush headers
        res.flushHeaders();
        
        // Send initial connection event
        res.write('data: {"type":"connection","status":"connected"}\n\n');
        
        // Send keepalive pings every 30 seconds to prevent Render timeout
        const keepAliveInterval = setInterval(() => {
          if (!res.destroyed) {
            res.write('data: {"type":"ping","timestamp":' + Date.now() + '}\n\n');
          } else {
            clearInterval(keepAliveInterval);
          }
        }, 30000);

        // Create MCP server instance
        const server = new Server(
          { name: SERVER_NAME, version: "0.1.0" },
          { capabilities: { tools: {} } }
        );
        
        server.onerror = (err) => {
          console.error("[MCP Server Error]", err);
        };

        await setupServerHandlers(server, tools);

        // Create SSE transport
        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        servers[transport.sessionId] = server;

        console.log(`SSE connection established. Session ID: ${transport.sessionId}`);

        // Handle client disconnect
        res.on("close", async () => {
          console.log(`SSE connection closed. Session ID: ${transport.sessionId}`);
          clearInterval(keepAliveInterval);
          delete transports[transport.sessionId];
          await server.close();
          delete servers[transport.sessionId];
        });

        // Handle connection errors
        res.on("error", (err) => {
          console.error("SSE connection error:", err);
        });

        // Connect server to transport
        await server.connect(transport);
        
      } catch (error) {
        console.error("SSE setup error:", error);
        
        // FIXED: Return proper error response with correct headers
        if (!res.headersSent) {
          const origin = req.headers.origin;
          if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
          }
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Content-Type', 'application/json');
          
          res.status(400).json({ 
            error: error.message,
            details: "Token validation or server setup failed"
          });
        }
      }
    });

    // FIXED: Companion POST endpoint for JSON-RPC calls
    app.post("/messages", async (req, res) => {
      try {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        const server = servers[sessionId];

        console.log(`POST /messages for session: ${sessionId}`);

        if (transport && server) {
          await transport.handlePostMessage(req, res);
        } else {
          console.error(`No transport/server found for sessionId: ${sessionId}`);
          res.status(400).json({ 
            error: "No transport/server found for sessionId",
            sessionId: sessionId,
            availableSessions: Object.keys(transports)
          });
        }
      } catch (error) {
        console.error("POST /messages error:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Handle Render health checks
    app.get("/", (req, res) => {
      res.json({ 
        status: "ok", 
        server: SERVER_NAME,
        message: "MCP Server is running"
      });
    });
    app.get("/health", (req, res) => {
      res.json({ 
        status: "ok", 
        server: SERVER_NAME, 
        activeSessions: Object.keys(transports).length,
        availableSessions: Object.keys(transports),
        headers: req.headers,
        url: req.url
      });
    });

    // Debug endpoint to test SSE without token
    app.get("/sse-test", (req, res) => {
      console.log("SSE test endpoint hit");
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      
      res.write('data: {"test": "connection working"}\n\n');
      
      // Keep connection alive for 10 seconds
      const interval = setInterval(() => {
        res.write(`data: {"time": "${new Date().toISOString()}"}\n\n`);
      }, 1000);
      
      setTimeout(() => {
        clearInterval(interval);
        res.end();
      }, 10000);
    });

    // Add error handling middleware
    app.use((err, req, res, next) => {
      console.error('Express error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`MCP Server running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`SSE endpoint: http://localhost:${port}/sse?token=<your-token>`);
    });
  } else {
    // stdio mode: single session over stdin/stdout
    const server = new Server(
      { name: SERVER_NAME, version: "0.1.0" },
      { capabilities: { tools: {} } }
    );
    server.onerror = (err) => console.error("[MCP Error]", err);

    await setupServerHandlers(server, tools);

    process.on("SIGINT", async () => {
      await server.close();
      process.exit(0);
    });

    const transport = new (await import("@modelcontextprotocol/sdk/server/stdio.js"))
      .StdioServerTransport();
    await server.connect(transport);
  }
}

run().catch((err) => {
  console.error("Server startup error:", err);
  process.exit(1);
});
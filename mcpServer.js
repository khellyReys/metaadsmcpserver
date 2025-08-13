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

// Token validation function
function validateToken(token) {
  if (!token) {
    throw new Error("Token is required");
  }
  
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
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
      "http://localhost:3000",
      "https://localhost:3000",
      "http://localhost:5173",
      "https://localhost:5173",
      "https://metaadsmcpserver-1.onrender.com"
    ];
    
    // Global CORS - let this handle most CORS logic
    app.use(cors({
      origin: (incomingOrigin, callback) => {
        if (!incomingOrigin || allowedOrigins.includes(incomingOrigin)) {
          callback(null, true);
        } else {
          console.error(`CORS blocked origin: ${incomingOrigin}`);
          callback(new Error(`Origin ${incomingOrigin} not allowed by CORS`));
        }
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "X-Requested-With"],
      credentials: true,
    }));

    // RENDER FIX: Global middleware to add Nginx bypass header
    app.use((req, res, next) => {
      // Add the critical header for ALL responses to bypass Render's Nginx buffering
      res.setHeader('X-Accel-Buffering', 'no');
      next();
    });

    // Skip JSON parsing for SSE endpoints
    app.use((req, res, next) => {
      if (req.path === "/messages") {
        next();
      } else {
        express.json()(req, res, next);
      }
    });

    // Root endpoint for Render health checks
    app.get("/", (req, res) => {
      res.json({ 
        status: "ok", 
        server: SERVER_NAME,
        message: "MCP Server is running"
      });
    });

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({ 
        status: "ok", 
        server: SERVER_NAME, 
        activeSessions: Object.keys(transports).length,
        availableSessions: Object.keys(transports)
      });
    });

    // Debug SSE endpoint (no auth required)
    app.get("/sse-test", (req, res) => {
      console.log("SSE test endpoint hit");
      
      // Let the response object set its own headers, just ensure our bypass header is set
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      res.write('data: {"test": "connection working"}\n\n');
      
      let counter = 0;
      const interval = setInterval(() => {
        counter++;
        res.write(`data: {"message": "test ${counter}", "time": "${new Date().toISOString()}"}\n\n`);
        
        if (counter >= 10) {
          clearInterval(interval);
          res.end();
        }
      }, 1000);
      
      req.on('close', () => {
        clearInterval(interval);
      });
    });

    // Main SSE endpoint
    app.get("/sse", async (req, res) => {
      console.log(`SSE request from origin: ${req.headers.origin}`);
      
      try {
        // Validate token
        const token = req.query.token;
        const tokenData = validateToken(token);
        console.log(`Token validated for server: ${tokenData.serverId}`);
        
        // Create MCP server instance
        const server = new Server(
          { name: SERVER_NAME, version: "0.1.0" },
          { capabilities: { tools: {} } }
        );
        
        server.onerror = (err) => {
          console.error("[MCP Server Error]", err);
        };

        await setupServerHandlers(server, tools);

        // Create transport and let MCP SDK handle headers
        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        servers[transport.sessionId] = server;

        console.log(`SSE connection established. Session ID: ${transport.sessionId}`);

        // Handle disconnection
        res.on("close", async () => {
          console.log(`SSE connection closed. Session ID: ${transport.sessionId}`);
          delete transports[transport.sessionId];
          await server.close();
          delete servers[transport.sessionId];
        });

        res.on("error", (err) => {
          console.error("SSE connection error:", err);
        });

        // Connect server to transport
        await server.connect(transport);
        
      } catch (error) {
        console.error("SSE setup error:", error);
        
        if (!res.headersSent) {
          res.status(400).json({ 
            error: error.message,
            details: "Token validation or server setup failed"
          });
        }
      }
    });

    // Messages endpoint for JSON-RPC calls
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

    // Error handling middleware
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
      console.log(`SSE test: http://localhost:${port}/sse-test`);
      console.log(`SSE endpoint: http://localhost:${port}/sse?token=<your-token>`);
    });
    
  } else {
    // stdio mode
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
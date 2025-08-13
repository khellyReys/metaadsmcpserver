#!/usr/bin/env node

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { discoverTools } from "./lib/tools.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

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
      const definitionFunction = tool.definition?.function;
      if (!definitionFunction) return;
      return {
        name: definitionFunction.name,
        description: definitionFunction.description,
        inputSchema: definitionFunction.parameters,
      };
    })
    .filter(Boolean);
}

async function setupServerHandlers(server, tools) {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: await transformTools(tools),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = tools.find((t) => t.definition.function.name === toolName);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }
    const args = request.params.arguments;
    const requiredParameters =
      tool.definition?.function?.parameters?.required || [];
    for (const requiredParameter of requiredParameters) {
      if (!(requiredParameter in args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Missing required parameter: ${requiredParameter}`
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
    } catch (error) {
      console.error("[Error] Failed to fetch data:", error);
      throw new McpError(
        ErrorCode.InternalError,
        `API error: ${error.message}`
      );
    }
  });
}

async function run() {
  const args = process.argv.slice(2);
  const isSSE = args.includes("--sse");
  const tools = await discoverTools();

  if (isSSE) {
    const app = express();
    const transports = {};
    const servers = {};

    // FIXED: Use built-in CORS middleware with proper configuration
    app.use(cors({
      origin: (origin, callback) => {
        // Allow all origins for now - you can restrict this later
        callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With'],
      optionsSuccessStatus: 200
    }));

    // Add JSON parsing middleware (but skip for SSE endpoints)
    app.use((req, res, next) => {
      if (req.path === "/messages" || req.path === "/sse") {
        next();
      } else {
        express.json()(req, res, next);
      }
    });

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        server: SERVER_NAME,
        activeSessions: Object.keys(transports).length,
        timestamp: new Date().toISOString()
      });
    });

    // Test SSE endpoint
    app.get("/test-sse", (req, res) => {
      console.log('Test SSE endpoint accessed');
      
      // Set proper SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true'
      });
      
      res.write('data: {"message": "Test SSE working", "timestamp": "' + new Date().toISOString() + '"}\n\n');
      
      const interval = setInterval(() => {
        res.write(`data: {"heartbeat": "${new Date().toISOString()}"}\n\n`);
      }, 3000);
      
      req.on('close', () => {
        console.log('Test SSE client disconnected');
        clearInterval(interval);
      });
    });

    // Main SSE endpoint with proper headers and token validation
    app.get("/sse", async (req, res) => {
      console.log('SSE endpoint accessed with token:', req.query.token ? 'present' : 'missing');
      
      try {
        // Validate token
        const token = req.query.token;
        const tokenData = validateToken(token);
        console.log('Token validated for server ID:', tokenData.serverId);

        // Set SSE headers BEFORE creating transport
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': req.headers.origin || '*',
          'Access-Control-Allow-Credentials': 'true',
          'X-Accel-Buffering': 'no'
        });

        console.log('SSE headers set successfully');

        // Create a new Server instance for each session
        const server = new Server(
          {
            name: SERVER_NAME,
            version: "0.1.0",
          },
          {
            capabilities: {
              tools: {},
            },
          }
        );
        
        server.onerror = (error) => console.error("[MCP Server Error]", error);
        await setupServerHandlers(server, tools);

        console.log('MCP server handlers configured');

        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        servers[transport.sessionId] = server;

        console.log('SSE transport created with sessionId:', transport.sessionId);

        res.on("close", async () => {
          console.log('SSE client disconnected, cleaning up sessionId:', transport.sessionId);
          delete transports[transport.sessionId];
          await server.close();
          delete servers[transport.sessionId];
        });

        await server.connect(transport);
        console.log('MCP server connected to transport successfully');

      } catch (error) {
        console.error('SSE setup error:', error);
        
        if (!res.headersSent) {
          res.status(400).json({
            error: error.message,
            details: "Token validation or server setup failed"
          });
        } else {
          res.end();
        }
      }
    });

    // POST endpoint for messages
    app.post("/messages", async (req, res) => {
      try {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        const server = servers[sessionId];

        console.log('POST /messages called for sessionId:', sessionId);
        console.log('Available sessions:', Object.keys(transports));

        if (transport && server) {
          await transport.handlePostMessage(req, res);
        } else {
          console.error('No transport/server found for sessionId:', sessionId);
          res.status(400).json({
            error: "No transport/server found for sessionId",
            sessionId: sessionId,
            availableSessions: Object.keys(transports)
          });
        }
      } catch (error) {
        console.error('POST /messages error:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // REMOVED: The problematic app.options("*", ...) handler that was causing the path-to-regexp error
    // CORS is already handled by the cors() middleware above

    // Basic 404 handler
    app.use((req, res) => {
      console.log('404 - Route not found:', req.method, req.path);
      res.status(404).json({
        error: 'Route not found',
        method: req.method,
        path: req.path,
        availableRoutes: ['/health', '/test-sse', '/sse', '/messages']
      });
    });

    // Error handler
    app.use((error, req, res, next) => {
      console.error('Express error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`[SSE Server] running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Test SSE: http://localhost:${port}/test-sse`);
      console.log(`Main SSE: http://localhost:${port}/sse?token=YOUR_TOKEN`);
    });
  } else {
    // stdio mode: single server instance
    const server = new Server(
      {
        name: SERVER_NAME,
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    server.onerror = (error) => console.error("[Error]", error);
    await setupServerHandlers(server, tools);

    process.on("SIGINT", async () => {
      await server.close();
      process.exit(0);
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

run().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
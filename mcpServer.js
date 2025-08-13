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

    // Updated allowed origins to include your frontend
    const allowedOrigins = [
      "http://localhost:3000",           // Your React dev server
      "https://localhost:3000",          // HTTPS localhost
      "http://localhost:5173",           // Vite default
      "https://localhost:5173",          // HTTPS Vite
      "https://metaadsmcpserver-1.onrender.com", // Replace with your actual frontend domain
      "http://127.0.0.1:3000",          // Alternative localhost
      "http://127.0.0.1:5173"           // Alternative localhost for Vite
    ];
    
    // Improved CORS configuration
    app.use(
      cors({
        origin: (incomingOrigin, callback) => {
          console.log('CORS check for origin:', incomingOrigin);
          
          // Allow requests with no origin (like mobile apps or curl)
          if (!incomingOrigin) {
            callback(null, true);
            return;
          }
          
          if (allowedOrigins.includes(incomingOrigin)) {
            callback(null, true);
          } else {
            console.log(`Origin ${incomingOrigin} not in allowed list:`, allowedOrigins);
            // Temporarily allow all origins for debugging - comment out the line below in production
            callback(null, true);
            // callback(new Error(`Origin ${incomingOrigin} not allowed by CORS`));
          }
        },
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: [
          "Content-Type", 
          "Authorization", 
          "Cache-Control", 
          "X-Requested-With",
          "Accept"
        ],
        credentials: true,
      })
    );

    // Middleware to skip JSON parsing for SSE endpoints
    app.use((req, res, next) => {
      if (req.path === "/messages" || req.path === "/sse") {
        next(); // skip JSON parsing for SSE
      } else {
        express.json()(req, res, next);
      }
    });

    // Basic test endpoint
    app.get("/test", (req, res) => {
      res.json({
        message: "Server is working",
        timestamp: new Date().toISOString(),
        server: SERVER_NAME,
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Simple SSE test endpoint
    app.get("/test-sse", (req, res) => {
      console.log('Test SSE endpoint hit');
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true'
      });
      
      // Send initial connection message
      res.write('data: {"message": "SSE connection established", "timestamp": "' + new Date().toISOString() + '"}\n\n');
      
      // Send periodic heartbeat
      const interval = setInterval(() => {
        res.write(`data: {"heartbeat": "${new Date().toISOString()}"}\n\n`);
      }, 5000);
      
      // Clean up on disconnect
      req.on('close', () => {
        console.log('Test SSE client disconnected');
        clearInterval(interval);
      });
    });

    // FIXED: SSE endpoint with proper headers
    app.get("/sse", async (req, res) => {
      console.log('SSE endpoint hit with token:', req.query.token ? 'present' : 'missing');
      
      try {
        // Validate token from query parameter
        const token = req.query.token;
        const tokenData = validateToken(token);
        console.log('Token validated successfully for server:', tokenData.serverId);
        
        // CRITICAL: Set SSE headers FIRST, before any other operations
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': req.headers.origin || '*',
          'Access-Control-Allow-Credentials': 'true',
          'X-Accel-Buffering': 'no'
        });
        
        console.log('SSE headers set successfully');

        // Create MCP server instance
        const server = new Server(
          { name: SERVER_NAME, version: "0.1.0" },
          { capabilities: { tools: {} } }
        );
        
        server.onerror = (err) => {
          console.error('MCP Server error:', err);
        };

        await setupServerHandlers(server, tools);
        console.log('MCP server handlers setup complete');

        // Create SSE transport - this should work now that headers are set
        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        servers[transport.sessionId] = server;
        
        console.log('SSE transport created with sessionId:', transport.sessionId);

        // Handle client disconnect
        res.on("close", async () => {
          console.log('Client disconnected, cleaning up session:', transport.sessionId);
          delete transports[transport.sessionId];
          await server.close();
          delete servers[transport.sessionId];
        });

        // Connect server to transport
        await server.connect(transport);
        console.log('MCP server connected to SSE transport successfully');
        
      } catch (error) {
        console.error('SSE setup error:', error);
        
        // Only send JSON error if headers haven't been sent yet
        if (!res.headersSent) {
          res.status(400).json({ 
            error: error.message,
            details: "Token validation or server setup failed"
          });
        } else {
          // If headers are already sent, we need to close the connection
          res.end();
        }
      }
    });

    // Handle preflight OPTIONS requests
    app.options("/sse", (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With, Accept');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.status(200).end();
    });

    // Companion POST endpoint for JSON-RPC calls
    app.post("/messages", async (req, res) => {
      try {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        const server = servers[sessionId];

        console.log('POST /messages called with sessionId:', sessionId);
        console.log('Available sessions:', Object.keys(transports));

        if (transport && server) {
          await transport.handlePostMessage(req, res);
        } else {
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

    // Enhanced health check endpoint
    app.get("/health", (req, res) => {
      res.json({ 
        status: "ok", 
        server: SERVER_NAME, 
        activeSessions: Object.keys(transports).length,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        endpoints: ['/sse', '/messages', '/health', '/test', '/test-sse'],
        availableSessions: Object.keys(transports)
      });
    });

    // Catch-all route for debugging
    app.use((req, res) => {
      console.log('Unhandled route:', req.method, req.path);
      res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method,
        availableEndpoints: ['/sse', '/messages', '/health', '/test', '/test-sse']
      });
    });

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`MCP Server running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Test SSE: http://localhost:${port}/test-sse`);
      console.log(`Main SSE: http://localhost:${port}/sse?token=YOUR_TOKEN`);
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
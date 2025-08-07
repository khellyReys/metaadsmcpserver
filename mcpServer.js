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
    console.log("Decoded token:", decoded);
    
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
      console.error("[Tool Error]", err);
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

    // FIXED: Updated allowed origins to include your frontend
    const allowedOrigins = [
      "http://localhost:3000",           // Your React dev server
      "https://localhost:3000",          // HTTPS localhost
      "http://localhost:5173",           // Vite default
      "https://localhost:5173",          // HTTPS Vite
      "https://your-frontend-domain.com" // Replace with your actual frontend domain
    ];
    
    // FIXED: Improved CORS configuration
    app.use(
      cors({
        origin: (incomingOrigin, callback) => {
          console.log("Incoming origin:", incomingOrigin);
          
          // Allow requests with no origin (like mobile apps or curl)
          if (!incomingOrigin) {
            callback(null, true);
            return;
          }
          
          if (allowedOrigins.includes(incomingOrigin)) {
            callback(null, true);
          } else {
            console.error(`Origin ${incomingOrigin} not allowed by CORS`);
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

    // Add body parser middleware
    app.use(express.json());

    // FIXED: SSE endpoint with token validation
    app.get("/sse", async (req, res) => {
      console.log("SSE connection attempt with query:", req.query);
      
      try {
        // Validate token from query parameter
        const token = req.query.token;
        const tokenData = validateToken(token);
        console.log("Token validated for server:", tokenData.serverId);
        
        // Set CORS headers explicitly for SSE
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        
        // Disable proxy buffering so the SDK's headers go out immediately
        res.setHeader("X-Accel-Buffering", "no");

        // Create MCP server instance
        const server = new Server(
          { name: SERVER_NAME, version: "0.1.0" },
          { capabilities: { tools: {} } }
        );
        
        server.onerror = (err) => {
          console.error("[MCP Error]", err);
        };

        await setupServerHandlers(server, tools);

        // Create SSE transport
        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        servers[transport.sessionId] = server;

        // Handle client disconnect
        res.on("close", async () => {
          console.log("SSE client disconnected, session:", transport.sessionId);
          delete transports[transport.sessionId];
          await server.close();
          delete servers[transport.sessionId];
        });

        // Connect server to transport
        await server.connect(transport);
        console.log("SSE connection established, session:", transport.sessionId);
        
      } catch (error) {
        console.error("SSE connection error:", error);
        res.status(400).json({ 
          error: error.message,
          details: "Token validation or server setup failed"
        });
      }
    });

    // Handle preflight OPTIONS requests
    app.options("/sse", (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.status(200).end();
    });

    // FIXED: Companion POST endpoint for JSON-RPC calls
    app.post("/messages", async (req, res) => {
      try {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        const server = servers[sessionId];

        console.log("POST /messages request for session:", sessionId);

        if (transport && server) {
          await transport.handlePostMessage(req, res);
        } else {
          console.error("No transport/server found for sessionId:", sessionId);
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

    // Add a health check endpoint
    app.get("/health", (req, res) => {
      res.json({ 
        status: "ok", 
        server: SERVER_NAME, 
        activeSessions: Object.keys(transports).length
      });
    });

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`[SSE Server] running on port ${port}`);
      console.log(`[SSE Server] allowed origins:`, allowedOrigins);
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
  console.error(err);
  process.exit(1);
});
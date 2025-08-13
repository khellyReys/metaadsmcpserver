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

    // CRITICAL: Add CORS support
    app.use(cors({
      origin: true, // Allow all origins for now
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "X-Requested-With"]
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
      // CRITICAL: Set proper SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true'
      });
      
      res.write('data: {"message": "Test SSE working"}\n\n');
      
      const interval = setInterval(() => {
        res.write(`data: {"time": "${new Date().toISOString()}"}\n\n`);
      }, 2000);
      
      req.on('close', () => {
        clearInterval(interval);
      });
    });

    // FIXED: Main SSE endpoint with proper headers and token validation
    app.get("/sse", async (req, res) => {
      console.log('SSE endpoint hit');
      
      try {
        // Validate token
        const token = req.query.token;
        const tokenData = validateToken(token);
        console.log('Token validated for server:', tokenData.serverId);

        // CRITICAL: Set SSE headers BEFORE creating transport
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': req.headers.origin || '*',
          'Access-Control-Allow-Credentials': 'true',
          'X-Accel-Buffering': 'no'
        });

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

        const transport = new SSEServerTransport("/messages", res);
        transports[transport.sessionId] = transport;
        servers[transport.sessionId] = server;

        console.log('SSE transport created, sessionId:', transport.sessionId);

        res.on("close", async () => {
          console.log('SSE client disconnected, sessionId:', transport.sessionId);
          delete transports[transport.sessionId];
          await server.close();
          delete servers[transport.sessionId];
        });

        await server.connect(transport);
        console.log('MCP server connected successfully');

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

    app.post("/messages", async (req, res) => {
      try {
        const sessionId = req.query.sessionId;
        const transport = transports[sessionId];
        const server = servers[sessionId];

        console.log('POST /messages, sessionId:', sessionId);

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

    // Handle OPTIONS requests
    app.options("*", (req, res) => {
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.sendStatus(200);
    });

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`[SSE Server] running on port ${port}`);
      console.log(`Health: http://localhost:${port}/health`);
      console.log(`Test SSE: http://localhost:${port}/test-sse`);
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

run().catch(console.error);
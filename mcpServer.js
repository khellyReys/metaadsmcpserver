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
    
    // Configure CORS
    const corsOptions = {
      origin: [
        'https://localhost:3000',
        'http://localhost:3000',
        'https://127.0.0.1:3000',
        'http://127.0.0.1:3000'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Cache-Control',
        'Accept',
        'Accept-Encoding',
        'Connection',
        'User-Agent'
      ]
    };

    // Apply CORS middleware
    app.use(cors(corsOptions));
    
    // Parse JSON bodies
    app.use(express.json());
    
    // Handle preflight requests
    app.options('*', cors(corsOptions));

    const transports = {};
    const servers = {};

    app.get("/sse", async (req, res) => {
      try {
        // Set SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': req.headers.origin || '*',
          'Access-Control-Allow-Credentials': 'true'
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
        server.onerror = (error) => console.error("[Error]", error);
        await setupServerHandlers(server, tools);

        // Fix: Create SSEServerTransport without problematic path parameter
        const transport = new SSEServerTransport("/messages", res);
        const sessionId = Math.random().toString(36).substring(7);
        transport.sessionId = sessionId;
        
        transports[sessionId] = transport;
        servers[sessionId] = server;

        res.on("close", async () => {
          delete transports[sessionId];
          await server.close();
          delete servers[sessionId];
        });

        await server.connect(transport);
      } catch (error) {
        console.error("[SSE Error]", error);
        if (!res.headersSent) {
          res.status(500).send("SSE connection failed");
        }
      }
    });

    app.post("/messages", async (req, res) => {
      const sessionId = req.query.sessionId;
      const transport = transports[sessionId];
      const server = servers[sessionId];

      if (transport && server) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(400).send("No transport/server found for sessionId");
      }
    });

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`[SSE Server] running on port ${port}`);
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
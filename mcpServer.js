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

    const allowedOrigins = [
      "http://localhost:5173",                        // local Vite
      "https://metaadsmcpserver-1.onrender.com"       // your deployed React app
    ];
    
    app.use(
      cors({
        origin: (incomingOrigin, callback) => {
          // allow requests with no origin (e.g. mobile apps, curl) or matching our list
          if (!incomingOrigin || allowedOrigins.includes(incomingOrigin)) {
            callback(null, true);
          } else {
            callback(new Error(`Origin ${incomingOrigin} not allowed by CORS`));
          }
        },
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true,
      })
    );

    // SSE “connect” endpoint
    app.get("/sse", async (_req, res) => {
      const server = new Server(
        { name: SERVER_NAME, version: "0.1.0" },
        { capabilities: { tools: {} } }
      );
      server.onerror = (err) => console.error("[MCP Error]", err);

      await setupServerHandlers(server, tools);

      const transport = new SSEServerTransport("/messages", res);
      transports[transport.sessionId] = transport;
      servers[transport.sessionId] = server;

      res.on("close", async () => {
        delete transports[transport.sessionId];
        await server.close();
        delete servers[transport.sessionId];
      });

      await server.connect(transport);
    });

    // Companion POST endpoint for JSON‑RPC calls tied to an SSE session
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

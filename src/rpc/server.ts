import * as readline from "readline";
import { toolRegistry } from "../tools/registry.js";
import { logger } from "../core/logger.js";

// Import tools to register them
import "../tools/terminal.js";
import "../tools/file-tools.js";
import "../tools/search-tools.js";
import "../tools/skills-tool.js";
import "../tools/kanban-tools.js";
import "../tools/cron-tools.js";

interface RPCRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

interface RPCResponse {
  id: string;
  result?: unknown;
  error?: { code: number; message: string };
}

export function startRPCServer(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  logger.info("RPC server started on stdin/stdout");

  rl.on("line", async (line) => {
    let request: RPCRequest;
    try {
      request = JSON.parse(line) as RPCRequest;
    } catch {
      const response: RPCResponse = {
        id: "0",
        error: { code: -32700, message: "Parse error" },
      };
      process.stdout.write(JSON.stringify(response) + "\n");
      return;
    }

    const response: RPCResponse = { id: request.id };

    try {
      switch (request.method) {
        case "tools/list": {
          response.result = toolRegistry.getDefinitions();
          break;
        }
        case "tools/call": {
          const { name, args } = request.params as { name: string; args: Record<string, unknown> };
          const handler = toolRegistry.getHandler(name);
          if (!handler) {
            response.error = { code: -32601, message: `Unknown tool: ${name}` };
          } else {
            response.result = await handler(args ?? {});
          }
          break;
        }
        default:
          response.error = { code: -32601, message: `Unknown method: ${request.method}` };
      }
    } catch (err) {
      response.error = {
        code: -32603,
        message: err instanceof Error ? err.message : String(err),
      };
    }

    process.stdout.write(JSON.stringify(response) + "\n");
  });

  rl.on("close", () => {
    logger.info("RPC server stopped");
    process.exit(0);
  });
}

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ToolDefinition } from "../providers/types.js";
import { logger } from "../core/logger.js";

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private serverName: string;
  private connected = false;
  private tools: ToolDefinition[] = [];

  constructor(serverName: string) {
    this.client = new Client(
      { name: "nexo-agent", version: "0.1.0" },
      { capabilities: {} }
    );
    this.serverName = serverName;
  }

  async connect(config: MCPServerConfig): Promise<void> {
    try {
      this.transport = new StdioClientTransport({
        command: config.command,
        args: config.args ?? [],
        env: config.env as Record<string, string> ?? {},
      });

      await this.client.connect(this.transport);
      this.connected = true;
      logger.info(`MCP server connected: ${this.serverName}`);

      // List available tools
      const response = await this.client.listTools();
      this.tools = response.tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: `${this.serverName}__${tool.name}`,
          description: tool.description ?? "",
          parameters: (tool.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
        },
      }));

      logger.info(`MCP server ${this.serverName}: ${this.tools.length} tools available`);
    } catch (err) {
      logger.error(`Failed to connect to MCP server ${this.serverName}`, err);
      throw err;
    }
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (!this.connected) {
      throw new Error(`MCP server ${this.serverName} is not connected`);
    }

    // Strip server prefix if present
    const originalName = toolName.includes("__")
      ? toolName.split("__")[1]
      : toolName;

    try {
      const result = await this.client.callTool({ name: originalName, arguments: args });
      const content = result.content;
      if (Array.isArray(content)) {
        return content
          .map((c) => (c.type === "text" ? c.text : JSON.stringify(c)))
          .join("\n");
      }
      return JSON.stringify(content);
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  getTools(): ToolDefinition[] {
    return this.tools;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
      logger.info(`MCP server disconnected: ${this.serverName}`);
    }
  }
}

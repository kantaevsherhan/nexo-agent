import type { ToolDefinition } from "../providers/types.js";

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface ToolEntry {
  name: string;
  toolset: string;
  schema: ToolDefinition;
  handler: ToolHandler;
}

class ToolRegistryImpl {
  private tools = new Map<string, ToolEntry>();

  register(entry: ToolEntry): void {
    this.tools.set(entry.name, entry);
  }

  getHandler(name: string): ToolHandler | undefined {
    return this.tools.get(name)?.handler;
  }

  getEntry(name: string): ToolEntry | undefined {
    return this.tools.get(name);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.schema);
  }

  list(): ToolEntry[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}

export const toolRegistry = new ToolRegistryImpl();

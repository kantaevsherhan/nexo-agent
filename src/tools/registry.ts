import type { ToolDefinition } from "../providers/types.js";

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface ToolEntry {
  name: string;
  toolset: string;
  schema: ToolDefinition;
  handler: ToolHandler;
}

export interface ToolsetDefinition {
  description: string;
  tools: string[];
  includes: string[];
}

const TOOLSETS: Record<string, ToolsetDefinition> = {
  terminal: {
    description: "Terminal execution tools",
    tools: ["terminal"],
    includes: [],
  },
  file: {
    description: "File system tools",
    tools: ["read_file", "write_file", "list_directory"],
    includes: [],
  },
  search: {
    description: "Search tools",
    tools: ["search_files"],
    includes: [],
  },
  skills: {
    description: "Skills management tools",
    tools: ["skills_list", "skill_view", "skill_create", "skill_apply"],
    includes: [],
  },
  kanban: {
    description: "Kanban task management tools",
    tools: ["kanban_create", "kanban_list", "kanban_complete", "kanban_block", "kanban_show"],
    includes: [],
  },
  cron: {
    description: "Cron scheduling tools",
    tools: ["cron_create", "cron_list", "cron_delete", "cron_pause", "cron_resume"],
    includes: [],
  },
  core: {
    description: "Core agent tools",
    tools: [],
    includes: ["terminal", "file", "search", "skills", "kanban", "cron"],
  },
};

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

  getDefinitions(toolsets?: string[]): ToolDefinition[] {
    const names = this.resolveToolNames(toolsets);
    return Array.from(names)
      .map((name) => this.tools.get(name))
      .filter((e): e is ToolEntry => e !== undefined)
      .map((t) => t.schema);
  }

  private resolveToolNames(toolsets?: string[]): Set<string> {
    const result = new Set<string>();
    const sets = toolsets ?? Object.keys(TOOLSETS);

    for (const setName of sets) {
      const def = TOOLSETS[setName];
      if (!def) continue;
      for (const tool of def.tools) result.add(tool);
      for (const included of def.includes) {
        for (const tool of this.resolveToolNames([included])) {
          result.add(tool);
        }
      }
    }
    return result;
  }

  list(): ToolEntry[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getToolsets(): Record<string, ToolsetDefinition> {
    return { ...TOOLSETS };
  }
}

export const toolRegistry = new ToolRegistryImpl();

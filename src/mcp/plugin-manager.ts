import { readdir } from "fs/promises";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { NEXO_HOME } from "../core/config.js";
import { logger } from "../core/logger.js";

export type PluginHook = "pre_tool_call" | "post_tool_call" | "pre_llm_call" | "post_llm_call" | "on_session_start" | "on_session_end";

export interface Plugin {
  name: string;
  version: string;
  description: string;
  hooks: Partial<Record<PluginHook, (data: unknown) => void | Promise<void>>>;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();

  async discover(): Promise<void> {
    const pluginDirs = [
      join(process.cwd(), "plugins"),
      join(NEXO_HOME, "plugins"),
    ];

    for (const dir of pluginDirs) {
      if (!existsSync(dir)) continue;
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          await this.loadPlugin(join(dir, entry.name));
        }
      } catch (err) {
        logger.error(`Failed to scan plugin directory: ${dir}`, err);
      }
    }
  }

  private async loadPlugin(pluginDir: string): Promise<void> {
    try {
      const manifestPath = join(pluginDir, "plugin.json");
      if (!existsSync(manifestPath)) return;

      const manifest = JSON.parse(
        readFileSync(manifestPath, "utf-8")
      ) as { name: string; version: string; description: string };

      const entryPath = join(pluginDir, "index.js");
      if (!existsSync(entryPath)) return;

      const mod = await import(entryPath);
      const plugin: Plugin = {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        hooks: mod.default?.hooks ?? mod.hooks ?? {},
      };

      this.plugins.set(plugin.name, plugin);
      logger.info(`Plugin loaded: ${plugin.name} v${plugin.version}`);
    } catch (err) {
      logger.error(`Failed to load plugin: ${pluginDir}`, err);
    }
  }

  async executeHook(hook: PluginHook, data: unknown): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const handler = plugin.hooks[hook];
      if (handler) {
        try {
          await handler(data);
        } catch (err) {
          logger.error(`Plugin ${plugin.name} hook ${hook} failed`, err);
        }
      }
    }
  }

  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}

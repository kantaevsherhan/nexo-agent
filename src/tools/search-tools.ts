import { readFile, readdir } from "fs/promises";
import { join, resolve, relative } from "path";
import { toolRegistry } from "./registry.js";

async function walkDir(dir: string, maxDepth: number = 5, currentDepth: number = 0): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await walkDir(fullPath, maxDepth, currentDepth + 1));
      } else {
        results.push(fullPath);
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return results;
}

toolRegistry.register({
  name: "search_files",
  toolset: "search",
  schema: {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for files matching a pattern or search file contents by regex.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "Search pattern: file glob (e.g. '*.ts') or regex for content (e.g. 'TODO|FIXME')",
          },
          path: {
            type: "string",
            description: "Directory to search in (default: current directory)",
          },
          mode: {
            type: "string",
            enum: ["files", "content"],
            description: "Search mode: 'files' for filename matching, 'content' for regex in file contents",
          },
        },
        required: ["pattern"],
      },
    },
  },
  handler: async (args) => {
    const pattern = args.pattern as string;
    const searchPath = resolve((args.path as string) || ".");
    const mode = (args.mode as string) || "files";

    if (mode === "files") {
      const allFiles = await walkDir(searchPath);
      const regex = new RegExp(pattern.replace(/\*/g, ".*").replace(/\?/g, "."), "i");
      const matches = allFiles
        .filter((f) => regex.test(f))
        .slice(0, 50)
        .map((f) => relative(searchPath, f));
      return JSON.stringify({ matches, count: matches.length });
    }

    // Content search
    const allFiles = await walkDir(searchPath);
    const regex = new RegExp(pattern, "gi");
    const results: Array<{ file: string; line: number; text: string }> = [];

    for (const file of allFiles) {
      if (results.length >= 100) break;
      try {
        const content = await readFile(file, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            results.push({
              file: relative(searchPath, file),
              line: i + 1,
              text: lines[i].trim().slice(0, 200),
            });
            regex.lastIndex = 0;
            if (results.length >= 100) break;
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return JSON.stringify({ results, count: results.length });
  },
});

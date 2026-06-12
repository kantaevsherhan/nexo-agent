import { readFile, writeFile, readdir, stat } from "fs/promises";
import { resolve } from "path";
import { toolRegistry } from "./registry.js";

const MAX_FILE_SIZE = 100 * 1024; // 100KB

toolRegistry.register({
  name: "read_file",
  toolset: "file",
  schema: {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to read",
          },
        },
        required: ["path"],
      },
    },
  },
  handler: async (args) => {
    const filePath = resolve(args.path as string);
    try {
      const info = await stat(filePath);
      if (info.size > MAX_FILE_SIZE) {
        return JSON.stringify({ error: `File too large (${info.size} bytes). Max: ${MAX_FILE_SIZE}` });
      }
      const content = await readFile(filePath, "utf-8");
      return JSON.stringify({ content });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
});

toolRegistry.register({
  name: "write_file",
  toolset: "file",
  schema: {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to write",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  handler: async (args) => {
    const filePath = resolve(args.path as string);
    const content = args.content as string;
    try {
      await writeFile(filePath, content, "utf-8");
      return JSON.stringify({ success: true, bytesWritten: content.length });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
});

toolRegistry.register({
  name: "list_directory",
  toolset: "file",
  schema: {
    type: "function",
    function: {
      name: "list_directory",
      description: "List files and directories at a given path.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory path to list (default: current directory)",
          },
        },
      },
    },
  },
  handler: async (args) => {
    const dirPath = resolve((args.path as string) || ".");
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const items = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
      return JSON.stringify({ entries: items });
    } catch (err) {
      return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
  },
});

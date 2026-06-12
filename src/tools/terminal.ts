import { exec } from "child_process";
import { promisify } from "util";
import { toolRegistry } from "./registry.js";

const execAsync = promisify(exec);

toolRegistry.register({
  name: "terminal",
  toolset: "terminal",
  schema: {
    type: "function",
    function: {
      name: "terminal",
      description: "Execute a shell command and return its output.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
        },
        required: ["command"],
      },
    },
  },
  handler: async (args) => {
    const command = args.command as string;
    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 1024 * 1024,
        timeout: 30000,
      });
      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : "");
      return JSON.stringify({ stdout: output.trim() });
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; message?: string };
      return JSON.stringify({
        error: error.message || "Command failed",
        stdout: error.stdout || "",
        stderr: error.stderr || "",
      });
    }
  },
});

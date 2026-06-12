import { getConfig } from "./config.js";

const AGENT_IDENTITY = `You are Nexo Agent, an AI assistant with tool-calling capabilities.
You can read/write files, execute shell commands, and perform web searches.
Always be helpful, accurate, and concise.
When using tools, explain what you're doing and why.`;

export interface SystemPromptParts {
  stable: string;
  context: string;
  volatile: string;
}

export function buildSystemPrompt(): string {
  const config = getConfig();
  const parts: SystemPromptParts = {
    stable: AGENT_IDENTITY,
    context: "",
    volatile: [
      `Current time: ${new Date().toISOString()}`,
      `Model: ${config.model}`,
      `Provider: ${config.provider}`,
      `Working directory: ${config.workdir || process.cwd()}`,
    ].join("\n"),
  };

  const sections = [parts.stable];
  if (parts.context) sections.push(parts.context);
  sections.push(parts.volatile);

  return sections.join("\n\n");
}

import { z } from "zod";

export const ProviderProfileSchema = z.object({
  name: z.string(),
  apiMode: z.enum(["chat_completions"]).default("chat_completions"),
  baseUrl: z.string(),
  envVars: z.array(z.string()).default([]),
  authType: z.enum(["api_key", "oauth"]).default("api_key"),
  supportsVision: z.boolean().default(false),
  fixedTemperature: z.number().nullable().default(null),
  defaultMaxTokens: z.number().nullable().default(null),
  defaultHeaders: z.record(z.string(), z.string()).default({}),
});

export type ProviderProfile = z.infer<typeof ProviderProfileSchema>;

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMResponse {
  content: string | null;
  tool_calls: ToolCall[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onComplete?: (response: LLMResponse) => void;
  onError?: (error: Error) => void;
}

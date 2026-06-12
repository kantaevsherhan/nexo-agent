import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ProviderProfile, LLMMessage, ToolDefinition, LLMResponse, StreamCallbacks, ToolCall } from "./types.js";
import { resolveApiKey } from "./registry.js";
import retry from "retry";

export interface LLMClientOptions {
  profile: ProviderProfile;
  model: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

export class LLMClient {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;
  private temperature: number | null;

  constructor(options: LLMClientOptions) {
    const apiKey = options.apiKey || resolveApiKey(options.profile);
    if (!apiKey) {
      throw new Error(
        `No API key found for provider "${options.profile.name}". ` +
        `Set one of: ${options.profile.envVars.join(", ")}`
      );
    }

    this.client = new OpenAI({
      baseURL: options.profile.baseUrl,
      apiKey,
      defaultHeaders: options.profile.defaultHeaders as Record<string, string>,
    });
    this.model = options.model;
    this.maxTokens = options.maxTokens ?? options.profile.defaultMaxTokens ?? 4096;
    this.temperature = options.temperature ?? options.profile.fixedTemperature;
  }

  private toOpenAIMessages(messages: LLMMessage[]): ChatCompletionMessageParam[] {
    return messages.map((msg): ChatCompletionMessageParam => {
      if (msg.role === "tool") {
        return {
          role: "tool",
          tool_call_id: msg.tool_call_id!,
          content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        };
      }
      if (msg.role === "assistant" && msg.tool_calls) {
        return {
          role: "assistant",
          content: typeof msg.content === "string" ? msg.content : null,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
        };
      }
      return {
        role: msg.role,
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      };
    });
  }

  async chat(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> {
    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: this.model,
      messages: this.toOpenAIMessages(messages),
      max_tokens: this.maxTokens,
    };
    if (this.temperature !== null) {
      params.temperature = this.temperature;
    }
    if (tools && tools.length > 0) {
      params.tools = tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        },
      }));
    }

    return new Promise((resolve, reject) => {
      const operation = retry.operation({
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 10000,
      });

      operation.attempt(async () => {
        try {
          const response = await this.client.chat.completions.create(params);
          const choice = response.choices[0];
          if (!choice) {
            reject(new Error("No choices in response"));
            return;
          }

          const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: (tc as Extract<typeof tc, { type: "function" }>).function.name,
              arguments: (tc as Extract<typeof tc, { type: "function" }>).function.arguments,
            },
          }));

          resolve({
            content: choice.message.content,
            tool_calls: toolCalls,
            usage: response.usage ? {
              prompt_tokens: response.usage.prompt_tokens,
              completion_tokens: response.usage.completion_tokens,
              total_tokens: response.usage.total_tokens,
            } : undefined,
            model: response.model,
          });
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          const status = (err as { status?: number }).status;
          if (status === 429 || (status ?? 0) >= 500) {
            if (operation.retry(error)) return;
          }
          reject(err);
        }
      });
    });
  }

  async *chatStream(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    callbacks?: StreamCallbacks,
  ): AsyncGenerator<string, LLMResponse, unknown> {
    const params: OpenAI.ChatCompletionCreateParamsStreaming = {
      model: this.model,
      messages: this.toOpenAIMessages(messages),
      max_tokens: this.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (this.temperature !== null) {
      params.temperature = this.temperature;
    }
    if (tools && tools.length > 0) {
      params.tools = tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        },
      }));
    }

    const stream = await this.client.chat.completions.create(params);

    let content = "";
    const toolCalls: ToolCall[] = [];
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
    let usage: LLMResponse["usage"];
    let model = this.model;

    try {
      for await (const chunk of stream) {
        model = chunk.model || model;
        if (chunk.usage) {
          usage = {
            prompt_tokens: chunk.usage.prompt_tokens,
            completion_tokens: chunk.usage.completion_tokens,
            total_tokens: chunk.usage.total_tokens,
          };
        }

        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          content += delta.content;
          callbacks?.onToken?.(delta.content);
          yield delta.content;
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallMap.has(idx)) {
              toolCallMap.set(idx, { id: tc.id ?? "", name: "", arguments: "" });
            }
            const existing = toolCallMap.get(idx)!;
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name += tc.function.name;
            if (tc.function?.arguments) existing.arguments += tc.function.arguments;
          }
        }
      }

      for (const [, tc] of toolCallMap) {
        const toolCall: ToolCall = {
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        };
        toolCalls.push(toolCall);
        callbacks?.onToolCall?.(toolCall);
      }

      const response: LLMResponse = {
        content: content || null,
        tool_calls: toolCalls,
        usage,
        model,
      };

      callbacks?.onComplete?.(response);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      callbacks?.onError?.(error);
      throw error;
    }
  }
}

import { randomUUID } from "crypto";
import { getConfig, type AppConfig } from "./config.js";
import { LLMClient } from "../providers/llm-client.js";
import type { LLMMessage, ToolDefinition } from "../providers/types.js";
import { getProviderProfile } from "../providers/registry.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { IterationBudget } from "./iteration-budget.js";
import { logger } from "./logger.js";
import { toolRegistry } from "../tools/registry.js";
import { SessionDB } from "../memory/session-db.js";

export interface AgentOptions {
  model?: string;
  provider?: string;
  apiKey?: string;
  systemPrompt?: string;
  maxIterations?: number;
  workdir?: string;
  sessionId?: string;
}

export interface AgentCallbacks {
  onToken?: (token: string) => void;
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  onToolComplete?: (name: string, result: string) => void;
  onStatus?: (status: string) => void;
}

export class Agent {
  readonly sessionId: string;
  private client: LLMClient;
  private messages: LLMMessage[];
  private budget: IterationBudget;
  private systemPrompt: string;
  private config: AppConfig;
  private callbacks: AgentCallbacks;
  private sessionDB: SessionDB;

  constructor(options: AgentOptions = {}) {
    this.config = getConfig();
    this.sessionId = options.sessionId ?? randomUUID();
    this.sessionDB = new SessionDB();

    const providerName = options.provider ?? this.config.provider;
    const profile = getProviderProfile(providerName);
    if (!profile) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    this.client = new LLMClient({
      profile,
      model: options.model ?? this.config.model,
      apiKey: options.apiKey ?? this.config.apiKey,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    this.systemPrompt = options.systemPrompt ?? buildSystemPrompt();
    this.budget = new IterationBudget(options.maxIterations ?? this.config.maxIterations);
    this.messages = [{ role: "system", content: this.systemPrompt }];
    this.callbacks = {};

    // Create or load session
    const existing = this.sessionDB.getSession(this.sessionId);
    if (!existing) {
      this.sessionDB.createSession(this.sessionId, "cli", this.config.model);
    } else {
      // Load existing messages
      const saved = this.sessionDB.getMessages(this.sessionId);
      if (saved.length > 0) {
        this.messages = [{ role: "system", content: this.systemPrompt }];
        for (const msg of saved) {
          const llmMsg: LLMMessage = {
            role: msg.role as LLMMessage["role"],
            content: msg.content,
          };
          if (msg.toolCalls) {
            llmMsg.tool_calls = JSON.parse(msg.toolCalls);
          }
          if (msg.toolCallId) {
            llmMsg.tool_call_id = msg.toolCallId;
          }
          this.messages.push(llmMsg);
        }
      }
    }

    logger.info(`Agent created: session=${this.sessionId} model=${this.config.model}`);
  }

  setCallbacks(callbacks: AgentCallbacks): void {
    this.callbacks = callbacks;
  }

  getTools(): ToolDefinition[] {
    return toolRegistry.getDefinitions();
  }

  async chat(userMessage: string): Promise<string> {
    this.messages.push({ role: "user", content: userMessage });
    this.sessionDB.addMessage(this.sessionId, "user", userMessage);

    let finalResponse = "";
    const tools = this.getTools();

    while (this.budget.consume()) {
      logger.debug(`Iteration ${this.budget.total - this.budget.remaining}/${this.budget.total}`);

      const response = await this.client.chat(this.messages, tools.length > 0 ? tools : undefined);

      // Add assistant message
      const assistantContent = response.content ?? "";
      const assistantToolCalls = response.tool_calls.length > 0 ? response.tool_calls : undefined;

      this.messages.push({
        role: "assistant",
        content: assistantContent,
        tool_calls: assistantToolCalls,
      });

      this.sessionDB.addMessage(
        this.sessionId,
        "assistant",
        assistantContent,
        assistantToolCalls ? JSON.stringify(assistantToolCalls) : undefined
      );

      // If no tool calls, we're done
      if (response.tool_calls.length === 0) {
        finalResponse = assistantContent;
        break;
      }

      // Execute tool calls
      for (const toolCall of response.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        this.callbacks.onToolStart?.(toolCall.function.name, args);
        this.callbacks.onStatus?.(`Executing ${toolCall.function.name}...`);

        let result: string;
        try {
          const handler = toolRegistry.getHandler(toolCall.function.name);
          if (!handler) {
            result = JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
          } else {
            result = await handler(args);
          }
        } catch (err) {
          result = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }

        this.callbacks.onToolComplete?.(toolCall.function.name, result);
        logger.debug(`Tool ${toolCall.function.name} result: ${result.slice(0, 200)}`);

        const toolMsg: LLMMessage = {
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        };
        this.messages.push(toolMsg);
        this.sessionDB.addMessage(this.sessionId, "tool", result, undefined, toolCall.id);
      }
    }

    return finalResponse;
  }

  reset(): void {
    this.messages = [{ role: "system", content: this.systemPrompt }];
    this.budget.reset();
    logger.info(`Agent session reset: ${this.sessionId}`);
  }

  getHistory(): LLMMessage[] {
    return [...this.messages];
  }

  searchMemory(query: string): Array<{ sessionId: string; role: string; content: string }> {
    return this.sessionDB.search(query);
  }

  close(): void {
    this.sessionDB.close();
  }
}

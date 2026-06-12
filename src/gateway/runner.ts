import { PlatformAdapter, type GatewayEvent } from "./platforms/base.js";
import { Agent, type AgentOptions } from "../core/agent.js";
import { logger } from "../core/logger.js";
import { CronScheduler } from "../cron/scheduler.js";

export interface GatewayConfig {
  adapters: PlatformAdapter[];
  maxAgents?: number;
  agentOptions?: AgentOptions;
}

export class GatewayRunner {
  private adapters: PlatformAdapter[] = [];
  private agents = new Map<string, Agent>();
  private cronScheduler: CronScheduler | null = null;
  private maxAgents: number;
  private agentOptions: AgentOptions;

  constructor(config: GatewayConfig) {
    this.adapters = config.adapters;
    this.maxAgents = config.maxAgents ?? 128;
    this.agentOptions = config.agentOptions ?? {};
  }

  async start(): Promise<void> {
    // Set up message handlers for each adapter
    for (const adapter of this.adapters) {
      adapter.onMessage(this.handleMessage.bind(this));
    }

    // Start all adapters
    await Promise.all(this.adapters.map((a) => a.connect()));
    await Promise.all(this.adapters.map((a) => a.start()));

    // Start cron scheduler
    this.cronScheduler = new CronScheduler(async (job) => {
      const agent = this.getOrCreateAgent(`cron-${job.id}`);
      await agent.chat(job.prompt);
    });
    this.cronScheduler.start();

    logger.info(`Gateway started with ${this.adapters.length} platform(s)`);
  }

  async stop(): Promise<void> {
    this.cronScheduler?.stop();
    await Promise.all(this.adapters.map((a) => a.disconnect()));
    for (const agent of this.agents.values()) {
      agent.close();
    }
    this.agents.clear();
    logger.info("Gateway stopped");
  }

  private getOrCreateAgent(sessionKey: string): Agent {
    let agent = this.agents.get(sessionKey);
    if (!agent) {
      if (this.agents.size >= this.maxAgents) {
        // Evict oldest agent
        const firstKey = this.agents.keys().next().value!;
        this.agents.get(firstKey)!.close();
        this.agents.delete(firstKey);
      }
      agent = new Agent({
        ...this.agentOptions,
        sessionId: sessionKey,
      });
      this.agents.set(sessionKey, agent);
    }
    return agent;
  }

  private async handleMessage(event: GatewayEvent): Promise<string> {
    const sessionKey = `${event.platform}:${event.chatId}`;
    const agent = this.getOrCreateAgent(sessionKey);
    logger.debug(`Message from ${event.platform}:${event.userId}: ${event.content.slice(0, 100)}`);
    return agent.chat(event.content);
  }

  getAdapters(): PlatformAdapter[] {
    return [...this.adapters];
  }

  getAgentCount(): number {
    return this.agents.size;
  }
}

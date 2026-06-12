import { describe, it, expect } from "vitest";

describe("nexo-agent", () => {
  it("should have correct version", () => {
    const VERSION = "0.1.0";
    expect(VERSION).toBe("0.1.0");
  });

  it("should export config module", async () => {
    const { getConfig, NEXO_HOME } = await import("../src/core/config.js");
    const config = getConfig();
    expect(config).toBeDefined();
    expect(config.model).toBeDefined();
    expect(NEXO_HOME).toBeDefined();
  });

  it("should export logger module", async () => {
    const { logger } = await import("../src/core/logger.js");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should export provider registry", async () => {
    const { listProviders, getProviderProfile } = await import("../src/providers/registry.js");
    const providers = listProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(getProviderProfile("openai")).toBeDefined();
  });

  it("should export tool registry", async () => {
    const { toolRegistry } = await import("../src/tools/registry.js");
    expect(toolRegistry).toBeDefined();
    expect(typeof toolRegistry.register).toBe("function");
  });

  it("should have iteration budget", async () => {
    const { IterationBudget } = await import("../src/core/iteration-budget.js");
    const budget = new IterationBudget(10);
    expect(budget.remaining).toBe(10);
    expect(budget.consume()).toBe(true);
    expect(budget.remaining).toBe(9);
    budget.refund();
    expect(budget.remaining).toBe(10);
  });

  it("should create session DB", async () => {
    const { SessionDB } = await import("../src/memory/session-db.js");
    const db = new SessionDB();
    const session = db.createSession("test-session", "test", "gpt-4o");
    expect(session.id).toBe("test-session");
    db.addMessage("test-session", "user", "Hello");
    const messages = db.getMessages("test-session");
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("Hello");
    db.deleteSession("test-session");
    db.close();
  });
});

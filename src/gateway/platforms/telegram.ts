import { Telegraf } from "telegraf";
import { PlatformAdapter, type GatewayEvent } from "./base.js";
import { logger } from "../../core/logger.js";

export class TelegramAdapter extends PlatformAdapter {
  readonly platform = "telegram";
  private bot: Telegraf;

  constructor(botToken: string) {
    super();
    this.bot = new Telegraf(botToken);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.on("text", async (ctx) => {
      const event: GatewayEvent = {
        platform: "telegram",
        chatId: String(ctx.chat.id),
        userId: String(ctx.from.id),
        content: ctx.message.text,
        timestamp: Date.now(),
      };

      if (!this.messageHandler) {
        await ctx.reply("Agent is not ready.");
        return;
      }

      try {
        await ctx.replyWithChatAction("typing");
        const response = await this.messageHandler(event);
        await ctx.reply(response, { parse_mode: "Markdown" });
      } catch (err) {
        logger.error("Telegram handler error", err);
        await ctx.reply("An error occurred while processing your message.");
      }
    });
  }

  async connect(): Promise<void> {
    logger.info("Telegram bot connecting...");
  }

  async disconnect(): Promise<void> {
    this.bot.stop();
    logger.info("Telegram bot disconnected");
  }

  async send(chatId: string, content: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, content, { parse_mode: "Markdown" });
  }

  async start(): Promise<void> {
    this.bot.launch();
    logger.info("Telegram bot started");
  }
}
